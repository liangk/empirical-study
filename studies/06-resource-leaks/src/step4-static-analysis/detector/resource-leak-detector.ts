import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';

/**
 * Standalone resource leak detector for the empirical study.
 * Adapted from Code Evolution Lab's resource-leaks-detector.ts.
 *
 * Detection categories (aligned with benchmark modules BM-01 through BM-06):
 * 1. unclosed_connection — DB connect/open/getConnection without close/end/release (BM-01)
 * 2. unclosed_stream — createReadStream/createWriteStream without close/destroy (BM-03)
 * 3. unclosed_file_handle — fs.open/openSync/fs.promises.open without close (BM-02)
 * 4. resource_without_cleanup — new WebSocket/Worker/EventSource without cleanup (BM-04)
 * 5. unclosed_timer — setInterval/setTimeout without clearInterval/clearTimeout (BM-05)
 * 6. unclosed_event_listener — on/addEventListener without removeListener/off (BM-06)
 */

export interface LeakFinding {
  file: string;
  line: number;
  patternType: 'unclosed_connection' | 'unclosed_stream' | 'unclosed_file_handle' | 'resource_without_cleanup' | 'unclosed_timer' | 'unclosed_event_listener';
  severity: 'high' | 'medium';
  description: string;
  method?: string;
}

const CONNECTION_METHODS = ['createConnection', 'connect', 'open', 'createPool', 'getConnection'];
const CLOSE_METHODS = ['close', 'end', 'destroy', 'release', 'disconnect', 'dispose'];
const STREAM_METHODS = ['createReadStream', 'createWriteStream', 'pipe', 'openSync'];
const DISPOSABLE_CLASSES = ['WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'BroadcastChannel', 'MessageChannel', 'AbortController'];
const TIMER_METHODS = ['setInterval', 'setTimeout'];
const CLEAR_TIMER_METHODS = ['clearInterval', 'clearTimeout'];
const EVENT_LISTENER_METHODS = ['on', 'addListener', 'addEventListener'];
const REMOVE_LISTENER_METHODS = ['off', 'removeListener', 'removeEventListener'];
 const MAX_FILE_SIZE_BYTES = 1024 * 1024;

 interface FunctionAnalysis {
   calledMethods: Set<string>;
   hasPipeToResponse: boolean;
   hasUsingDeclaration: boolean;
   hasFinallyClose: boolean;
 }

 const functionAnalysisCache = new WeakMap<object, FunctionAnalysis>();

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
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE_BYTES) return null;
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

function getCalledMethodName(node: any): string | undefined {
  return node.callee?.property?.name || node.callee?.name;
}

function getFunctionAnalysis(scopeNode: any, scope: any): FunctionAnalysis {
  const cached = functionAnalysisCache.get(scopeNode);
  if (cached) return cached;

  const analysis: FunctionAnalysis = {
    calledMethods: new Set<string>(),
    hasPipeToResponse: false,
    hasUsingDeclaration: false,
    hasFinallyClose: false,
  };

  try {
    traverse(scopeNode, {
      CallExpression(innerPath: any) {
        const method = getCalledMethodName(innerPath.node);
        if (method) analysis.calledMethods.add(method);
        if (method === 'pipe') {
          const target = innerPath.node.arguments?.[0]?.name;
          if (target === 'res' || target === 'response') analysis.hasPipeToResponse = true;
        }
      },
      VariableDeclaration(innerPath: any) {
        if (innerPath.node.kind === 'using') analysis.hasUsingDeclaration = true;
      },
      TryStatement(innerPath: any) {
        if (!innerPath.node.finalizer) return;
        try {
          traverse(innerPath.node.finalizer, {
            CallExpression(finallyPath: any) {
              const method = getCalledMethodName(finallyPath.node);
              if (method && CLOSE_METHODS.includes(method)) analysis.hasFinallyClose = true;
            },
          }, innerPath.scope);
        } catch { }
      },
    }, scope);
  } catch { }

  functionAnalysisCache.set(scopeNode, analysis);
  return analysis;
}

export function detectLeaks(filePath: string): LeakFinding[] {
  const ast = parseFile(filePath);
  if (!ast) return [];

  const findings: LeakFinding[] = [];

  traverse(ast, {
    CallExpression(nodePath: any) {
      const node = nodePath.node;
      const methodName = getCalledMethodName(node);
      const line = node.loc?.start?.line ?? 0;
      const fnScope = nodePath.getFunctionParent();
      const fnAnalysis = fnScope ? getFunctionAnalysis(fnScope.node, fnScope.scope) : null;

      // 1. Unclosed connection
      if (methodName && CONNECTION_METHODS.includes(methodName) && fnAnalysis) {
        const hasClose = CLOSE_METHODS.some(method => fnAnalysis.calledMethods.has(method));
        if (!hasClose && !fnAnalysis.hasFinallyClose && !fnAnalysis.hasUsingDeclaration) {
          findings.push({
            file: filePath, line,
            patternType: 'unclosed_connection',
            severity: 'high',
            description: `Connection created with '${methodName}' without close/release in function scope`,
            method: methodName,
          });
        }
      }

      // 2. Unclosed stream
      if (methodName && STREAM_METHODS.includes(methodName) && fnAnalysis) {
        const hasCloseOrEnd = ['close', 'end', 'destroy'].some(method => fnAnalysis.calledMethods.has(method));
        if (!hasCloseOrEnd && !fnAnalysis.hasPipeToResponse) {
          findings.push({
            file: filePath, line,
            patternType: 'unclosed_stream',
            severity: 'high',
            description: `Stream created with '${methodName}' without close/destroy`,
            method: methodName,
          });
        }
      }

      // 3. Unclosed file handle
      const isFileOpen = methodName === 'open' || methodName === 'openSync';
      const isFsPromisesOpen = node.callee?.object?.property?.name === 'promises' && methodName === 'open';
      if ((isFileOpen || isFsPromisesOpen) && methodName && !CONNECTION_METHODS.includes(methodName)) {
        // Disambiguate: only flag if callee looks like fs.open / fs.promises.open
        const calleeObj = node.callee?.object?.name || node.callee?.object?.property?.name;
        if ((calleeObj === 'fs' || calleeObj === 'promises' || methodName === 'openSync') && fnAnalysis) {
          const hasClose = ['close', 'closeSync'].some(method => fnAnalysis.calledMethods.has(method));
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

      if (methodName && TIMER_METHODS.includes(methodName) && fnAnalysis) {
        const hasClear = CLEAR_TIMER_METHODS.some(method => fnAnalysis.calledMethods.has(method));
        if (!hasClear) {
          findings.push({
            file: filePath, line,
            patternType: 'unclosed_timer',
            severity: 'medium',
            description: `Timer created with '${methodName}' without clearInterval/clearTimeout`,
            method: methodName,
          });
        }
      }

      if (node.callee?.property && EVENT_LISTENER_METHODS.includes(node.callee.property.name) && fnAnalysis) {
        const hasRemove = REMOVE_LISTENER_METHODS.some(method => fnAnalysis.calledMethods.has(method));
        if (!hasRemove) {
          findings.push({
            file: filePath, line,
            patternType: 'unclosed_event_listener',
            severity: 'medium',
            description: `Event listener added with '${node.callee.property.name}' without removeListener/off`,
            method: node.callee.property.name,
          });
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
      const fnAnalysis = getFunctionAnalysis(fnScope.node, fnScope.scope);
      const hasCleanup = cleanupMethods.some(method => fnAnalysis.calledMethods.has(method));

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
