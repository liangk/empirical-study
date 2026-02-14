// Adapted from Code Evolution Lab — backend/src/detectors/blocking-io-detector.ts
// Study-specific simplification: keep detection + context classification only (no auto-fix generation).
//
// Why this file matters:
// - It finds synchronous APIs that block Node.js' event loop.
// - It attaches execution-context signals (request path, startup path, etc.).
// - It records evidence so a human reviewer can audit how each classification was produced.

import traverse from '@babel/traverse';
import { ScanIssue, AnalysisContext } from './types';

// File-system calls that are known to block until I/O completes.
const SYNC_FILE_METHODS = [
  'readFileSync', 'writeFileSync', 'appendFileSync', 'copyFileSync',
  'mkdirSync', 'rmdirSync', 'unlinkSync', 'renameSync', 'statSync',
  'lstatSync', 'existsSync', 'readdirSync', 'readlinkSync', 'realpathSync',
  'chmodSync', 'chownSync', 'truncateSync', 'utimesSync', 'accessSync',
  'openSync', 'closeSync', 'fstatSync', 'ftruncateSync', 'futimesSync',
  'fsyncSync', 'fdatasyncSync', 'linkSync', 'symlinkSync',
];

// CPU-heavy crypto calls with Sync variants that block the main thread.
const SYNC_CRYPTO_METHODS = [
  'pbkdf2Sync', 'scryptSync', 'generateKeyPairSync', 'generateKeySync',
  'randomFillSync',
];

// Child process APIs that block the caller until the child exits.
const SYNC_CHILD_PROCESS = ['execSync', 'execFileSync', 'spawnSync'];

// Synchronous compression/decompression APIs (can be expensive for large payloads).
const SYNC_ZLIB_METHODS = [
  'deflateSync', 'deflateRawSync', 'gzipSync', 'gunzipSync',
  'inflateSync', 'inflateRawSync', 'brotliCompressSync', 'brotliDecompressSync',
  'unzipSync',
];

// HTTP route registration methods used by popular Node frameworks.
const ROUTE_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'use', 'all', 'route'];

let issueCounter = 0;

// Keep IDs unique in one scan process so every finding is easy to trace.
function generateId(): string {
  return `scan-${Date.now()}-${++issueCounter}`;
}

// Capture only a short code snippet around the finding for report readability.
function getCode(node: any, sourceCode: string): string {
  if (!node.start || !node.end) return '';
  return sourceCode.substring(node.start, Math.min(node.end, node.start + 200));
}

// Loop detection is used because blocking-in-loop multiplies impact and severity.
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

// Finds the nearest function-like ancestor. Used by handler-reference heuristics.
function getEnclosingFunctionNode(path: any): any | null {
  let current = path.parentPath;
  while (current) {
    const type = current.node?.type;
    if (type === 'FunctionDeclaration' ||
        type === 'FunctionExpression' ||
        type === 'ArrowFunctionExpression' ||
        type === 'ClassMethod' ||
        type === 'ObjectMethod') {
      return current.node;
    }
    current = current.parentPath;
  }
  return null;
}

// Detects framework-style route registration calls (e.g., app.get('/x', handler)).
function isRouteRegistrationCall(path: any): boolean {
  const callee = path.node?.callee;
  const methodName = callee?.property?.name;
  return ROUTE_METHODS.includes(methodName);
}

//
// Code Evolution Lab adaptation note:
// This two-pass handler collection is adapted from route ancestry techniques used
// in broader static analysis systems. We use it to catch references like:
//   const login = (...) => ...
//   router.post('/login', login)
// where the blocking call is not directly inside the route registration call site.
//
function collectReferencedRequestHandlers(ast: any): WeakSet<object> {
  const handlers = new WeakSet<object>();

  traverse(ast, {
    CallExpression(path: any) {
      if (!isRouteRegistrationCall(path)) return;

      const args = path.node.arguments || [];
      for (const arg of args) {
        if (!arg) continue;

        if (arg.type === 'FunctionExpression' || arg.type === 'ArrowFunctionExpression') {
          handlers.add(arg);
          continue;
        }

        if (arg.type === 'Identifier') {
          const binding = path.scope.getBinding(arg.name);
          const boundNode = binding?.path?.node;
          if (!boundNode) continue;

          if (boundNode.type === 'FunctionDeclaration') {
            handlers.add(boundNode);
          } else if (boundNode.type === 'VariableDeclarator') {
            const init = boundNode.init;
            if (init && (init.type === 'FunctionExpression' || init.type === 'ArrowFunctionExpression')) {
              handlers.add(init);
            }
          }
        }
      }
    },
  });

  return handlers;
}

// Checks whether the current blocking call lives in a function registered as a route handler.
function isInReferencedRequestHandler(path: any, referencedHandlers: WeakSet<object>): boolean {
  const fnNode = getEnclosingFunctionNode(path);
  if (!fnNode) return false;
  return referencedHandlers.has(fnNode);
}

// Process-level events (beforeExit, uncaughtException, etc.) run outside request paths.
function isInProcessEventCallback(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    const callee = current.node?.callee;
    const method = callee?.property?.name;
    const objectName = callee?.object?.name;
    if ((method === 'on' || method === 'once' || method === 'addListener') && objectName === 'process') {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

// Structural request-handler detection via ancestry + conventional parameter names.
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

// Module init means code that runs during startup/import, usually before serving traffic.
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

// Path hints are deliberately broad. They reduce unknowns but are weaker than AST evidence.
function isToolingFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return [
    '/test/', '/tests/', '/__tests__/', '/e2e/', '/fixtures/', '/__mocks__/',
    '/scripts/', '/benchmark/', '/benchmarks/', '/migrations/', '/migration/', '/seed/',
  ].some((part) => normalized.includes(part));
}

// File naming conventions frequently reveal request-path intent in large repos.
function isRequestPathFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return [
    '/route', '/routes/', '/controller', '/controllers/', '/middleware', '/middlewares/',
    '/api/', '/server/', '/handler', '/handlers/', '/graphql/resolver', '/resolvers/',
  ].some((part) => normalized.includes(part));
}

// Background workers are important to classify separately from synchronous request work.
function isBackgroundPathFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return [
    '/job', '/jobs/', '/queue', '/queues/', '/worker', '/workers/', '/cron/', '/schedule',
    '/consumer', '/consumers/', '/subscriber', '/subscribers/',
  ].some((part) => normalized.includes(part));
}

// Startup file hints help avoid over-labeling initialization code as unknown.
function isStartupPathFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return [
    '/main.', '/index.', '/bootstrap', '/server.', '/app.', '/bin/www', '/cli.',
  ].some((part) => normalized.includes(part));
}

// setTimeout/setInterval callbacks are treated as background execution contexts.
function isInTimerCallback(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    const callee = current.node?.callee;
    const name = callee?.name || callee?.property?.name;
    if (['setTimeout', 'setInterval', 'setImmediate'].includes(name)) return true;
    current = current.parentPath;
  }
  return false;
}

// Generic event listeners (e.g., emitter.on) are background-ish by default.
function isInEventListenerCallback(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    const callee = current.node?.callee;
    const method = callee?.property?.name;
    if (['on', 'once', 'addEventListener'].includes(method)) return true;
    current = current.parentPath;
  }
  return false;
}

// Promise-chain callbacks can run off request path (jobs, startup, internal pipelines).
function isInPromiseCallback(path: any): boolean {
  let current = path.parentPath;
  while (current) {
    const callee = current.node?.callee;
    const method = callee?.property?.name;
    if (['then', 'catch', 'finally'].includes(method)) return true;
    current = current.parentPath;
  }
  return false;
}

// Best-effort function naming for diagnostics in scan outputs.
function getEnclosingFunctionName(path: any): string | undefined {
  let current = path.parentPath;
  while (current) {
    const node = current.node;
    if (!node) {
      current = current.parentPath;
      continue;
    }
    if (node.type === 'FunctionDeclaration') return node.id?.name;
    if (node.type === 'ClassMethod') return node.key?.name;
    if (node.type === 'ObjectMethod') return node.key?.name;
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
      const parent = current.parentPath?.node;
      if (parent?.type === 'VariableDeclarator') return parent.id?.name;
      if (parent?.type === 'AssignmentExpression') return parent.left?.name;
      if (parent?.type === 'ObjectProperty') return parent.key?.name;
    }
    current = current.parentPath;
  }
  return undefined;
}

// Store a short ancestry fingerprint to make classification auditable.
function getAncestorKinds(path: any, limit: number = 8): string[] {
  const kinds: string[] = [];
  let current = path.parentPath;
  while (current && kinds.length < limit) {
    const type = current.node?.type;
    if (type) kinds.push(type);
    current = current.parentPath;
  }
  return kinds;
}

type ContextClassification = {
  context: ScanIssue['context'];
  contextDetail: string;
  matchedBy: string[];
  inLoop: boolean;
  inRequestHandler: boolean;
};

function classifyContext(path: any, filePath: string, referencedHandlers: WeakSet<object>): ContextClassification {
  // Core feature extraction pass.
  // We intentionally capture both AST-derived signals and file-path hints, then
  // resolve them with deterministic precedence to keep the study reproducible.
  const inLoop = isInLoop(path);
  const inRequestHandlerBySyntax = isInRequestHandler(path);
  const inRequestHandlerByReference = isInReferencedRequestHandler(path, referencedHandlers);
  const inRequestHandler = inRequestHandlerBySyntax || inRequestHandlerByReference;
  const inTimer = isInTimerCallback(path);
  const inListener = isInEventListenerCallback(path);
  const inPromise = isInPromiseCallback(path);
  const inProcessEvent = isInProcessEventCallback(path);
  const inInit = isModuleInit(path);
  const toolingFile = isToolingFile(filePath);
  const requestPathFile = isRequestPathFile(filePath);
  const backgroundPathFile = isBackgroundPathFile(filePath);
  const startupPathFile = isStartupPathFile(filePath);

  const matchedBy: string[] = [];
  if (inLoop) matchedBy.push('in_loop');
  if (inRequestHandlerBySyntax) matchedBy.push('request_handler_heuristic');
  if (inRequestHandlerByReference) matchedBy.push('request_handler_reference');
  if (inTimer) matchedBy.push('timer_callback');
  if (inListener) matchedBy.push('event_listener_callback');
  if (inPromise) matchedBy.push('promise_chain_callback');
  if (inProcessEvent) matchedBy.push('process_event_callback');
  if (inInit) matchedBy.push('module_init');
  if (toolingFile) matchedBy.push('tooling_file_path');
  if (requestPathFile) matchedBy.push('request_path_file_hint');
  if (backgroundPathFile) matchedBy.push('background_path_file_hint');
  if (startupPathFile) matchedBy.push('startup_path_file_hint');

  // Deterministic precedence is critical for reproducibility across runs.
  // Strongest to weakest:
  // tooling_path > request_path > background_path > startup_path > unknown_path
  //
  // Rationale:
  // - tooling files are usually non-production execution surfaces.
  // - request path should outrank background/startup because user impact is highest.
  // - unknown is a last resort when we cannot justify a stronger label.
  if (toolingFile) {
    return {
      context: 'tooling_path',
      contextDetail: inLoop ? 'tooling_path_inside_loop' : 'tooling_or_test_file',
      matchedBy,
      inLoop,
      inRequestHandler,
    };
  }

  if (inRequestHandler) {
    return {
      context: 'request_path',
      contextDetail: inLoop ? 'handler_inside_loop' : 'request_handler',
      matchedBy,
      inLoop,
      inRequestHandler,
    };
  }

  if (requestPathFile) {
    return {
      context: 'request_path',
      contextDetail: inLoop ? 'request_file_hint_inside_loop' : 'request_path_file_hint',
      matchedBy,
      inLoop,
      inRequestHandler,
    };
  }

  if (inTimer || inListener || inPromise || inProcessEvent || backgroundPathFile) {
    const detail = inLoop
      ? 'background_callback_inside_loop'
      : inTimer
        ? 'timer_callback'
        : inListener
          ? 'event_listener_callback'
          : inPromise
            ? 'promise_chain_callback'
            : inProcessEvent
              ? 'process_event_callback'
              : 'background_path_file_hint';
    return {
      context: 'background_path',
      contextDetail: detail,
      matchedBy,
      inLoop,
      inRequestHandler,
    };
  }

  if (inInit || startupPathFile) {
    return {
      context: 'startup_path',
      contextDetail: inInit ? 'module_or_constructor_init' : 'startup_path_file_hint',
      matchedBy,
      inLoop,
      inRequestHandler,
    };
  }

  return {
    context: 'unknown_path',
    contextDetail: inLoop ? 'unknown_inside_loop' : 'unknown_ancestry',
    matchedBy,
    inLoop,
    inRequestHandler,
  };
}

export function detectBlockingIO(ast: any, ctx: AnalysisContext): ScanIssue[] {
  // Main detection pass.
  // First pass collects route-handler references.
  // Second pass scans call expressions for synchronous APIs.
  const issues: ScanIssue[] = [];
  const referencedHandlers = collectReferencedRequestHandlers(ast);

  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node;
      const callee = node.callee;
      const methodName = callee?.property?.name || callee?.name;
      if (!methodName) return;

      // Map method name to normalized issue category for aggregation/reporting.
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

      const classification = classifyContext(path, ctx.filePath, referencedHandlers);
      const { context, contextDetail, matchedBy, inLoop, inRequestHandler } = classification;
      // Severity policy: request-path + loops are treated as the highest-risk cases.
      const severity: ScanIssue['severity'] =
        (context === 'request_path' && inLoop) ? 'critical' :
        context === 'request_path' ? 'high' :
        (context === 'background_path' && inLoop) ? 'high' :
        context === 'background_path' ? 'medium' :
        context === 'startup_path' ? 'low' :
        context === 'tooling_path' ? 'low' :
        inLoop ? 'high' : 'medium';

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
        contextDetail,
        matchedBy,
        enclosingFunction: getEnclosingFunctionName(path),
        ancestorKinds: getAncestorKinds(path),
        method: methodName,
        asyncAlternative: asyncAlt,
      });
    },
  });

  return issues;
}
