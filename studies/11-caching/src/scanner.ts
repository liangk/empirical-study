import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';

export interface CacheFinding {
  file: string;
  line: number;
  column: number;
  category: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  signature: string;
  snippet: string;
  occurrenceCount: number;
  occurrences: Array<{ file: string; line: number; column: number; snippet: string }>;
}

const CACHE_CATEGORIES = {
  repeatedHttpFetch: 'repeated_http_fetch',
  repeatedGraphql: 'repeated_graphql_query',
  repeatedDbCall: 'repeated_db_query',
  repeatedPureCompute: 'repeated_pure_compute',
};

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function getSnippet(code: string, line: number): string {
  return code.split('\n')[line - 1]?.trim().slice(0, 140) ?? '';
}

function makeSignature(parts: string[]): string {
  return parts.filter(Boolean).join(' | ').replace(/\s+/g, ' ').trim();
}

function serializeArgument(arg: any): string {
  if (!arg) return '<unknown>';
  switch (arg.type) {
    case 'StringLiteral':
      return arg.value;
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
      return String(arg.value);
    case 'Identifier':
      return arg.name;
    case 'TemplateLiteral':
      return arg.quasis.map((q: any) => q.value.cooked).join('${}');
    case 'ObjectExpression':
      return '{...}';
    case 'ArrayExpression':
      return '[...]';
    case 'MemberExpression':
      return getMemberPath(arg);
    default:
      return '<expr>';
  }
}

function isSimpleArgument(arg: any): boolean {
  if (!arg) return false;
  return [
    'StringLiteral',
    'NumericLiteral',
    'BooleanLiteral',
    'NullLiteral',
    'Identifier',
    'TemplateLiteral',
    'ObjectExpression',
    'ArrayExpression',
    'MemberExpression',
  ].includes(arg.type);
}

function isLikelyPureCallee(callee: any): boolean {
  if (callee.type !== 'Identifier') return false;
  const name = callee.name;
  const impureNames = new Set([
    'fetch', 'axios', 'http', 'https', 'setTimeout', 'setInterval', 'console', 'process', 'Date', 'Math',
    'readFile', 'writeFile', 'send', 'request', 'query', 'execute', 'save', 'update', 'delete', 'create',
    'findMany', 'findFirst', 'findUnique', 'gql', 'memoize', 'cache', 'useMemo', 'React',
  ]);
  if (impureNames.has(name)) return false;
  const impurePrefixes = ['get', 'fetch', 'load', 'save', 'update', 'delete', 'send', 'create', 'write', 'set', 'clear'];
  if (impurePrefixes.some((prefix) => name.startsWith(prefix))) return false;
  const pureComputePrefixes = [
    'build',
    'calculate',
    'compute',
    'decode',
    'derive',
    'encode',
    'format',
    'hash',
    'normalize',
    'parse',
    'render',
    'serialize',
    'transform',
    'validate',
  ];
  if (!pureComputePrefixes.some((prefix) => name.startsWith(prefix))) return false;
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

function getExpressionPath(node: any): string {
  if (!node) return '<unknown>';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'MemberExpression') {
    const objectName = getExpressionPath(node.object);
    const propName = node.computed ? getExpressionPath(node.property) : getPropertyName(node.property);
    return `${objectName}.${propName}`;
  }
  if (node.type === 'CallExpression') return `${getExpressionPath(node.callee)}()`;
  return '<expr>';
}

function getMemberPath(callee: any): string {
  return getExpressionPath(callee);
}

function getPropertyName(property: any): string {
  if (!property) return '<property>';
  if (property.type === 'Identifier') return property.name;
  if (property.type === 'StringLiteral') return property.value;
  if (property.type === 'NumericLiteral') return String(property.value);
  return '<property>';
}

function normalizeUrlArgument(arg: any): string {
  if (!arg) return '<dynamic-url>';
  if (arg.type === 'StringLiteral') return arg.value;
  if (arg.type === 'TemplateLiteral') return arg.quasis.map((q: any) => q.value.cooked).join('${}');
  if (arg.type === 'Identifier') return `<dynamic:${arg.name}>`;
  return '<dynamic-url>';
}

function getHttpMethod(args: any[], fallback: string): string {
  const options = args[1];
  if (options?.type !== 'ObjectExpression') return fallback;
  const methodProp = options.properties?.find((prop: any) => {
    if (prop.type !== 'ObjectProperty') return false;
    return getPropertyName(prop.key).toLowerCase() === 'method';
  });
  if (!methodProp) return fallback;
  if (methodProp.value?.type === 'StringLiteral') return methodProp.value.value.toUpperCase();
  return '<dynamic-method>';
}

function isCacheableHttpMethod(method: string): boolean {
  return ['GET', 'HEAD', '<dynamic-method>'].includes(method);
}

function detectHttpSignature(callee: any, args: any[]): string | undefined {
  if (callee.type === 'Identifier' && callee.name === 'fetch') {
    const method = getHttpMethod(args, 'GET');
    if (!isCacheableHttpMethod(method)) return undefined;
    return makeSignature(['fetch', normalizeUrlArgument(args[0]), `method=${method}`]);
  }

  if (callee.type === 'MemberExpression') {
    const objectName = getExpressionPath(callee.object);
    const propName = getPropertyName(callee.property);
    if (propName === 'fetch' && objectName === 'window') {
      const method = getHttpMethod(args, 'GET');
      if (!isCacheableHttpMethod(method)) return undefined;
      return makeSignature(['window.fetch', normalizeUrlArgument(args[0]), `method=${method}`]);
    }
    if (objectName === 'axios' || objectName === 'http' || objectName === 'https') {
      if (!isCacheableHttpMethod(propName.toUpperCase())) return undefined;
      return makeSignature([objectName, propName || 'request', normalizeUrlArgument(args[0])]);
    }
    if (['get', 'head'].includes(propName) && (objectName.includes('axios') || objectName.includes('client') || objectName.includes('api'))) {
      return makeSignature(['http', objectName, propName, normalizeUrlArgument(args[0])]);
    }
  }

  return undefined;
}

function detectGraphqlSignature(callee: any, args: any[]): string | undefined {
  if (callee.type === 'Identifier' && callee.name === 'gql') {
    const queryArg = args[0];
    if (queryArg?.type === 'TemplateLiteral') {
      const query = queryArg.quasis.map((q: any) => q.value.cooked).join('${}');
      return makeSignature(['graphql', query.trim()]);
    }
  }

  if (callee.type === 'MemberExpression') {
    const objectName = getExpressionPath(callee.object);
    const propName = getPropertyName(callee.property);
    if (['query', 'mutate', 'watchQuery', 'execute'].includes(propName) && (objectName.includes('client') || objectName.includes('apollo') || objectName.includes('graphql'))) {
      const queryArg = extractGraphqlQueryArg(args[0]);
      if (queryArg?.type === 'StringLiteral' || queryArg?.type === 'TemplateLiteral') {
        const query = queryArg.type === 'StringLiteral' ? queryArg.value : queryArg.quasis.map((q: any) => q.value.cooked).join('${}');
        return makeSignature(['graphql', objectName, propName, query.trim()]);
      }
    }
  }

  return undefined;
}

function extractGraphqlQueryArg(arg: any): any {
  if (!arg) return undefined;
  if (arg.type === 'StringLiteral' || arg.type === 'TemplateLiteral') return arg;
  if (arg.type !== 'ObjectExpression') return undefined;
  const queryProp = arg.properties?.find((prop: any) => {
    if (prop.type !== 'ObjectProperty') return false;
    return ['query', 'mutation', 'document'].includes(getPropertyName(prop.key));
  });
  if (!queryProp) return undefined;
  if (queryProp.value?.type === 'TaggedTemplateExpression' && getExpressionPath(queryProp.value.tag) === 'gql') {
    return queryProp.value.quasi;
  }
  return queryProp.value;
}

function detectDbSignature(callee: any, args: any[]): string | undefined {
  if (callee.type === 'MemberExpression') {
    const objectName = getExpressionPath(callee.object);
    const propName = getPropertyName(callee.property);
    const dbMethods = ['aggregate', 'count', 'execute', 'find', 'findAll', 'findById', 'findMany', 'findOne', 'findFirst', 'findUnique', 'query', 'raw'];
    if (dbMethods.includes(propName) && (objectName.includes('prisma') || objectName.includes('db') || objectName.includes('Sequelize') || objectName.includes('knex') || objectName.includes('repository') || objectName.includes('model'))) {
      const queryArg = args[0];
      const normalizedArg = queryArg?.type === 'StringLiteral' ? queryArg.value : serializeArgument(queryArg);
      return makeSignature(['db', objectName, propName, normalizedArg]);
    }
  }

  return undefined;
}

function collectFindings(filePath: string): CacheFinding[] {
  const code = readFile(filePath);
  if (!code) return [];

  let ast: any;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    return [];
  }

  const findings: CacheFinding[] = [];
  const httpCalls = new Map<string, Array<{ line: number; column: number; snippet: string }>>();
  const graphqlCalls = new Map<string, Array<{ line: number; column: number; snippet: string }>>();
  const dbCalls = new Map<string, Array<{ line: number; column: number; snippet: string }>>();
  const pureComputes = new Map<string, Array<{ line: number; column: number; snippet: string }>>();

  const addOccurrence = (map: Map<string, Array<{ line: number; column: number; snippet: string }>>, key: string, location: any) => {
    const loc = location.node.loc?.start;
    if (!loc) return;
    const entry = { line: loc.line, column: loc.column, snippet: getSnippet(code, loc.line) };
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  };

  traverse(ast, {
    TaggedTemplateExpression(tagPath: any) {
      const tagName = getExpressionPath(tagPath.node.tag);
      if (tagName !== 'gql' && !tagName.endsWith('.gql')) return;
      const query = tagPath.node.quasi.quasis.map((q: any) => q.value.cooked).join('${}');
      const signature = makeSignature(['graphql', query.trim()]);
      addOccurrence(graphqlCalls, signature, tagPath);
    },
    CallExpression(callPath: any) {
      const callee = callPath.node.callee;
      if (!callee) return;
      const args = callPath.node.arguments;

      const httpSignature = detectHttpSignature(callee, args);
      if (httpSignature) {
        addOccurrence(httpCalls, httpSignature, callPath);
        return;
      }

      const graphqlSignature = detectGraphqlSignature(callee, args);
      if (graphqlSignature) {
        addOccurrence(graphqlCalls, graphqlSignature, callPath);
        return;
      }

      const dbSignature = detectDbSignature(callee, args);
      if (dbSignature) {
        addOccurrence(dbCalls, dbSignature, callPath);
        return;
      }

      if (callee.type === 'Identifier' && isLikelyPureCallee(callee)) {
        const sameSimpleArgs = args.every(isSimpleArgument);
        if (sameSimpleArgs && args.length > 0) {
          const argSignature = args.map(serializeArgument).join(', ');
          const signature = makeSignature(['pure_compute', callee.name, argSignature]);
          addOccurrence(pureComputes, signature, callPath);
        }
      }
    }
  });

  const collect = (map: Map<string, Array<{ line: number; column: number; snippet: string }>>, category: string, severity: 'high' | 'medium' | 'low') => {
    for (const [signature, occurrences] of map.entries()) {
      if (occurrences.length < 2) continue;
      const findingOccurrences = occurrences.map((occurrence) => ({ file: filePath, ...occurrence }));
      findings.push({
        file: filePath,
        line: occurrences[0].line,
        column: occurrences[0].column,
        category,
        severity,
        message: `Detected ${occurrences.length} identical ${category.replace(/_/g, ' ')} calls`,
        signature,
        snippet: occurrences[0].snippet,
        occurrenceCount: occurrences.length,
        occurrences: findingOccurrences,
      });
    }
  };

  collect(httpCalls, CACHE_CATEGORIES.repeatedHttpFetch, 'high');
  collect(graphqlCalls, CACHE_CATEGORIES.repeatedGraphql, 'high');
  collect(dbCalls, CACHE_CATEGORIES.repeatedDbCall, 'high');
  collect(pureComputes, CACHE_CATEGORIES.repeatedPureCompute, 'medium');

  return findings;
}

function scanFiles(rootDir: string): string[] {
  const patterns = ['**/*.{js,jsx,ts,tsx,mjs}'];
  const ignore = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/__tests__/**', '**/*.d.ts'];
  return patterns.flatMap((pattern) => glob.sync(pattern, { cwd: rootDir, absolute: true, ignore }));
}

export async function scanDirectory(rootDir: string, outputPath: string) {
  const absoluteRoot = path.resolve(rootDir);
  const files = scanFiles(absoluteRoot);
  const findings = files.flatMap((file) => collectFindings(file));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(findings, null, 2), 'utf8');
  console.log(`Scanned ${files.length} files and wrote ${findings.length} findings to ${outputPath}`);
  return findings;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const pathArg = args.includes('--path') ? args[args.indexOf('--path') + 1] : '.';
  const output = args.includes('--output') ? args[args.indexOf('--output') + 1] : 'results/cache-opportunities.json';
  scanDirectory(pathArg, output).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
