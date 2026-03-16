import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';

/**
 * Standalone resource leak detector for the empirical study.
 * Adapted from Code Evolution Lab's resource-leaks-detector.ts.
 *
 * Detection categories:
 * 1. unclosed_connection — DB connect/open/getConnection without close/end/release
 * 2. unclosed_stream — createReadStream/createWriteStream without close/destroy
 * 3. unclosed_file_handle — fs.open/openSync/fs.promises.open without close
 * 4. resource_without_cleanup — new WebSocket/Worker/EventSource without cleanup
 */

export interface LeakFinding {
  file: string;
  line: number;
  patternType: 'unclosed_connection' | 'unclosed_stream' | 'unclosed_file_handle' | 'resource_without_cleanup';
  severity: 'high' | 'medium';
  description: string;
  method?: string;
}

const CONNECTION_METHODS = ['createConnection', 'connect', 'open', 'createPool', 'getConnection'];
const CLOSE_METHODS = ['close', 'end', 'destroy', 'release', 'disconnect', 'dispose'];
const STREAM_METHODS = ['createReadStream', 'createWriteStream', 'pipe', 'openSync'];
const DISPOSABLE_CLASSES = ['WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'BroadcastChannel', 'MessageChannel', 'AbortController'];

const CLEANUP_MAP: Record<string, string[]> = {
  'WebSocket': ['close'],
  'EventSource': ['close'],
  'Worker': ['terminate'],
  'SharedWorker': ['close'],
  'BroadcastChannel': ['close'],
  'MessageChannel': ['close'],
  'AbortController': ['abort'],
};

function parseFile(filePath: string): any | null {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    return parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties', 'optionalChaining', 'nullishCoalescingOperator'],
      errorRecovery: true,
    });
  } catch {
    return null;
  }
}

function hasMethodInScope(scopeNode: any, scope: any, methods: string[]): boolean {
  let found = false;
  try {
    traverse(scopeNode, {
      CallExpression(innerPath: any) {
        const method = innerPath.node.callee?.property?.name;
        if (methods.includes(method)) found = true;
      },
    }, scope);
  } catch { /* ignore traversal errors */ }
  return found;
}

function hasTryFinallyClose(scopeNode: any, scope: any): boolean {
  let found = false;
  try {
    traverse(scopeNode, {
      TryStatement(innerPath: any) {
        if (innerPath.node.finalizer) {
          traverse(innerPath.node.finalizer, {
            CallExpression(finallyPath: any) {
              const method = finallyPath.node.callee?.property?.name;
              if (CLOSE_METHODS.includes(method)) found = true;
            },
          }, innerPath.scope);
        }
      },
    }, scope);
  } catch { /* ignore */ }
  return found;
}

function hasUsingDeclaration(scopeNode: any, scope: any): boolean {
  let found = false;
  try {
    traverse(scopeNode, {
      VariableDeclaration(innerPath: any) {
        if (innerPath.node.kind === 'using') found = true;
      },
    }, scope);
  } catch { /* ignore */ }
  return found;
}

export function detectLeaks(filePath: string): LeakFinding[] {
  const ast = parseFile(filePath);
  if (!ast) return [];

  const findings: LeakFinding[] = [];

  traverse(ast, {
    CallExpression(nodePath: any) {
      const node = nodePath.node;
      const methodName = node.callee?.property?.name || node.callee?.name;
      const line = node.loc?.start?.line ?? 0;

      // 1. Unclosed connection
      if (CONNECTION_METHODS.includes(methodName)) {
        const fnScope = nodePath.getFunctionParent();
        if (fnScope) {
          const hasClose = hasMethodInScope(fnScope.node, fnScope.scope, CLOSE_METHODS);
          const hasFinally = hasTryFinallyClose(fnScope.node, fnScope.scope);
          const hasUsing = hasUsingDeclaration(fnScope.node, fnScope.scope);
          if (!hasClose && !hasFinally && !hasUsing) {
            findings.push({
              file: filePath, line,
              patternType: 'unclosed_connection',
              severity: 'high',
              description: `Connection created with '${methodName}' without close/release in function scope`,
              method: methodName,
            });
          }
        }
      }

      // 2. Unclosed stream
      if (STREAM_METHODS.includes(methodName)) {
        const fnScope = nodePath.getFunctionParent();
        if (fnScope) {
          let hasCloseOrEnd = false;
          let hasPipeToResponse = false;
          try {
            traverse(fnScope.node, {
              CallExpression(innerPath: any) {
                const m = innerPath.node.callee?.property?.name;
                if (['close', 'end', 'destroy'].includes(m)) hasCloseOrEnd = true;
                if (m === 'pipe') {
                  const target = innerPath.node.arguments?.[0]?.name;
                  if (target === 'res' || target === 'response') hasPipeToResponse = true;
                }
              },
            }, fnScope.scope);
          } catch { /* ignore */ }

          if (!hasCloseOrEnd && !hasPipeToResponse) {
            findings.push({
              file: filePath, line,
              patternType: 'unclosed_stream',
              severity: 'high',
              description: `Stream created with '${methodName}' without close/destroy`,
              method: methodName,
            });
          }
        }
      }

      // 3. Unclosed file handle
      const isFileOpen = methodName === 'open' || methodName === 'openSync';
      const isFsPromisesOpen = node.callee?.object?.property?.name === 'promises' && methodName === 'open';
      if ((isFileOpen || isFsPromisesOpen) && !CONNECTION_METHODS.includes(methodName)) {
        // Disambiguate: only flag if callee looks like fs.open / fs.promises.open
        const calleeObj = node.callee?.object?.name || node.callee?.object?.property?.name;
        if (calleeObj === 'fs' || calleeObj === 'promises' || methodName === 'openSync') {
          const fnScope = nodePath.getFunctionParent();
          if (fnScope) {
            const hasClose = hasMethodInScope(fnScope.node, fnScope.scope, ['close', 'closeSync']);
            if (!hasClose) {
              findings.push({
                file: filePath, line,
                patternType: 'unclosed_file_handle',
                severity: 'high',
                description: `File opened with '${methodName}' without close()`,
                method: methodName,
              });
            }
          }
        }
      }
    },

    // 4. Resource without cleanup
    VariableDeclarator(nodePath: any) {
      const node = nodePath.node;
      const init = node.init;
      if (!init || init.type !== 'NewExpression') return;

      const className = init.callee?.name;
      if (!DISPOSABLE_CLASSES.includes(className)) return;

      const fnScope = nodePath.parentPath?.getFunctionParent();
      if (!fnScope) return;

      const cleanupMethods = CLEANUP_MAP[className] || ['close', 'terminate', 'abort'];
      const hasCleanup = hasMethodInScope(fnScope.node, fnScope.scope, cleanupMethods);

      if (!hasCleanup) {
        findings.push({
          file: nodePath.node.loc?.start ? filePath : filePath,
          line: node.loc?.start?.line ?? 0,
          patternType: 'resource_without_cleanup',
          severity: 'medium',
          description: `${className} created without cleanup (${cleanupMethods.join('/')})`,
          method: className,
        });
      }
    },
  });

  return findings;
}

/**
 * Scan a directory for all .ts/.js files and run leak detection.
 */
export function scanDirectory(targetPath: string): LeakFinding[] {
  const pattern = path.join(targetPath, '**/*.{ts,js,mts,mjs,cts,cjs}').replace(/\\/g, '/');
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**', '**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
  });

  const allFindings: LeakFinding[] = [];
  for (const file of files) {
    const findings = detectLeaks(file);
    allFindings.push(...findings);
  }
  return allFindings;
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const pathIdx = args.indexOf('--path');
  const targetPath = pathIdx >= 0 ? args[pathIdx + 1] : process.cwd();

  console.log(`Scanning ${targetPath} for resource leak patterns...\n`);
  const findings = scanDirectory(targetPath);

  if (findings.length === 0) {
    console.log('No resource leak patterns found.');
  } else {
    console.log(`Found ${findings.length} potential resource leak(s):\n`);
    for (const f of findings) {
      console.log(`  [${f.severity.toUpperCase()}] ${f.patternType}`);
      console.log(`    ${f.file}:${f.line}`);
      console.log(`    ${f.description}\n`);
    }

    // Summary
    const byType = new Map<string, number>();
    for (const f of findings) byType.set(f.patternType, (byType.get(f.patternType) ?? 0) + 1);
    console.log('Summary:');
    for (const [type, count] of byType) console.log(`  ${type}: ${count}`);
  }
}
