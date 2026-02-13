// Adapted from Code Evolution Lab — backend/src/detectors/blocking-io-detector.ts
// Simplified for study purposes: detection + context classification only, no solution generation.

import traverse from '@babel/traverse';
import { ScanIssue, AnalysisContext } from './types';

const SYNC_FILE_METHODS = [
  'readFileSync', 'writeFileSync', 'appendFileSync', 'copyFileSync',
  'mkdirSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'statSync',
  'lstatSync', 'existsSync', 'readdirSync', 'readlinkSync', 'realpathSync',
  'chmodSync', 'chownSync', 'truncateSync', 'utimesSync', 'accessSync',
  'openSync', 'closeSync', 'fstatSync', 'ftruncateSync', 'futimesSync',
  'fsyncSync', 'fdatasyncSync', 'linkSync', 'symlinkSync',
];

const SYNC_CRYPTO_METHODS = [
  'pbkdf2Sync', 'scryptSync', 'generateKeyPairSync', 'generateKeySync',
  'randomFillSync',
];

const SYNC_CHILD_PROCESS = ['execSync', 'execFileSync', 'spawnSync'];

const SYNC_ZLIB_METHODS = [
  'deflateSync', 'deflateRawSync', 'gzipSync', 'gunzipSync',
  'inflateSync', 'inflateRawSync', 'brotliCompressSync', 'brotliDecompressSync',
  'unzipSync',
];

let issueCounter = 0;

function generateId(): string {
  return `scan-${Date.now()}-${++issueCounter}`;
}

function getCode(node: any, sourceCode: string): string {
  if (!node.start || !node.end) return '';
  return sourceCode.substring(node.start, Math.min(node.end, node.start + 200));
}

function isInLoop(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    const type = current.node?.type;
    if (['ForStatement', 'ForOfStatement', 'ForInStatement', 'WhileStatement', 'DoWhileStatement'].includes(type)) {
      return true;
    }
    if (current.node?.callee?.property?.name === 'forEach' ||
        current.node?.callee?.property?.name === 'map') {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

function isInRequestHandler(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    const callee = current.node?.callee;
    const methodName = callee?.property?.name;

    // Express-style: app.get(), router.post(), app.use(), etc.
    if (['get', 'post', 'put', 'delete', 'patch', 'use', 'all'].includes(methodName)) {
      const objectName = callee?.object?.name || callee?.object?.callee?.name;
      if (['app', 'router', 'express', 'server', 'route'].includes(objectName)) {
        return true;
      }
    }

    // Koa-style: router.get(), ctx callback
    if (methodName === 'use' || methodName === 'get' || methodName === 'post') {
      const objectName = callee?.object?.name;
      if (objectName === 'koaRouter' || objectName === 'ctx') return true;
    }

    // Fastify-style: fastify.get(), fastify.route()
    if (['get', 'post', 'put', 'delete', 'route'].includes(methodName)) {
      const objectName = callee?.object?.name;
      if (objectName === 'fastify' || objectName === 'instance') return true;
    }

    // Function with (req, res) or (request, response) params
    if (current.node?.type === 'FunctionDeclaration' ||
        current.node?.type === 'FunctionExpression' ||
        current.node?.type === 'ArrowFunctionExpression') {
      const params = current.node.params || [];
      const paramNames = params.map((p: any) => p.name || p.left?.name).filter(Boolean);
      if ((paramNames.includes('req') && paramNames.includes('res')) ||
          (paramNames.includes('request') && paramNames.includes('response')) ||
          (paramNames.includes('ctx'))) {
        return true;
      }
    }

    current = current.parentPath;
  }
  return false;
}

function isModuleInit(path: any): boolean {
  let current = path.parentPath;
  let depth = 0;
  while (current) {
    depth++;
    // If we're only 1-2 levels deep from the Program node, it's top-level init
    if (current.node?.type === 'Program' && depth <= 3) return true;
    // Inside a class constructor is also init
    if (current.node?.kind === 'constructor') return true;
    current = current.parentPath;
  }
  return false;
}

function classifyContext(path: any): ScanIssue['context'] {
  if (isInRequestHandler(path) && isInLoop(path)) return 'loop'; // worst case
  if (isInRequestHandler(path)) return 'request_handler';
  if (isInLoop(path)) return 'loop';
  if (isModuleInit(path)) return 'init';
  return 'other';
}

export function detectBlockingIO(ast: any, ctx: AnalysisContext): ScanIssue[] {
  const issues: ScanIssue[] = [];

  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node;
      const callee = node.callee;
      const methodName = callee?.property?.name || callee?.name;
      if (!methodName) return;

      let type: string | null = null;
      let asyncAlt = '';

      if (SYNC_FILE_METHODS.includes(methodName)) {
        type = 'sync_file_operation';
        asyncAlt = methodName.replace('Sync', '');
      } else if (SYNC_CRYPTO_METHODS.includes(methodName)) {
        type = 'sync_crypto_operation';
        asyncAlt = methodName.replace('Sync', '');
      } else if (SYNC_CHILD_PROCESS.includes(methodName)) {
        type = 'sync_child_process';
        asyncAlt = methodName.replace('Sync', '');
      } else if (SYNC_ZLIB_METHODS.includes(methodName)) {
        type = 'sync_zlib_operation';
        asyncAlt = methodName.replace('Sync', '');
      }

      if (!type) return;

      const context = classifyContext(path);
      const inLoop = isInLoop(path);
      const inHandler = isInRequestHandler(path);
      const severity: ScanIssue['severity'] =
        (inLoop && inHandler) ? 'critical' :
        inHandler ? 'high' :
        inLoop ? 'high' :
        context === 'init' ? 'low' : 'medium';

      issues.push({
        id: generateId(),
        type,
        severity,
        filePath: ctx.filePath,
        lineNumber: node.loc?.start.line || 0,
        title: `Blocking ${type.replace('sync_', '').replace('_', ' ')}: ${methodName}`,
        description: `Synchronous operation '${methodName}' blocks the event loop.`,
        code: getCode(node, ctx.sourceCode),
        context,
        method: methodName,
        asyncAlternative: asyncAlt,
      });
    },
  });

  return issues;
}
