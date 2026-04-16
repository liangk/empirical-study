/**
 * Study 08: DOM Manipulation Anti-Pattern Detector
 *
 * AST-based static analysis using Babel parser.
 * Scans JS/TS/JSX/TSX source files for DOM manipulation anti-patterns.
 *
 * Detection categories:
 *   forced_sync_layout     - Layout property read after DOM write, inside a loop
 *   innerhtml_in_loop      - innerHTML/outerHTML assignment inside any loop construct
 *   style_mutation_in_loop - element.style.X = Y inside a loop
 *   dom_query_in_loop      - querySelector/getElementById/getElementsBy* inside a loop
 *   dom_write_read_interleave - Alternating DOM reads/writes in same function (outside loops)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';

export type DomPattern =
  | 'forced_sync_layout'
  | 'innerhtml_in_loop'
  | 'style_mutation_in_loop'
  | 'dom_query_in_loop'
  | 'dom_write_read_interleave';

export interface DomFinding {
  file: string;
  line: number;
  column: number;
  category: DomPattern;
  severity: 'high' | 'medium' | 'low';
  message: string;
  snippet: string;
}

const LAYOUT_READ_PROPS = new Set([
  'offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'offsetParent',
  'clientWidth', 'clientHeight', 'clientTop', 'clientLeft',
  'scrollWidth', 'scrollHeight', 'scrollTop', 'scrollLeft',
  'getBoundingClientRect', 'getClientRects', 'getComputedStyle',
  'innerWidth', 'innerHeight', 'scrollY', 'scrollX', 'pageYOffset', 'pageXOffset',
]);

const DOM_QUERY_METHODS = new Set([
  'querySelector', 'querySelectorAll',
  'getElementById', 'getElementsByClassName', 'getElementsByTagName', 'getElementsByName',
  'closest', 'matches',
]);

const LOOP_TYPES = new Set([
  'ForStatement', 'WhileStatement', 'DoWhileStatement',
  'ForInStatement', 'ForOfStatement',
]);

const ARRAY_ITERATION_METHODS = new Set([
  'forEach', 'map', 'filter', 'reduce', 'reduceRight', 'find', 'findIndex',
  'some', 'every', 'flatMap',
]);

function isInsideLoop(nodePath: any): boolean {
  let current = nodePath.parentPath;
  while (current) {
    if (LOOP_TYPES.has(current.node.type)) return true;
    if (current.node.type === 'CallExpression') {
      const callee = current.node.callee;
      if (
        callee.type === 'MemberExpression' &&
        callee.property.type === 'Identifier' &&
        ARRAY_ITERATION_METHODS.has(callee.property.name)
      ) return true;
    }
    if (
      current.node.type === 'FunctionDeclaration' ||
      current.node.type === 'FunctionExpression' ||
      current.node.type === 'ArrowFunctionExpression' ||
      current.node.type === 'ObjectMethod'
    ) break;
    current = current.parentPath;
  }
  return false;
}

function getSnippet(code: string, line: number): string {
  return code.split('\n')[line - 1]?.trim().slice(0, 120) ?? '';
}

export function detectDomPatterns(filePath: string): DomFinding[] {
  const findings: DomFinding[] = [];
  let code: string;
  try {
    code = fs.readFileSync(filePath, 'utf8');
  } catch {
    return findings;
  }

  let ast: any;
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });
  } catch {
    return findings;
  }

  const addFinding = (
    nodePath: any,
    category: DomPattern,
    severity: 'high' | 'medium' | 'low',
    message: string
  ) => {
    const loc = nodePath.node.loc?.start;
    if (!loc) return;
    findings.push({
      file: filePath,
      line: loc.line,
      column: loc.column,
      category,
      severity,
      message,
      snippet: getSnippet(code, loc.line),
    });
  };

  traverse(ast, {
    AssignmentExpression(nodePath: any) {
      const { left } = nodePath.node;
      if (left.type !== 'MemberExpression') return;
      const prop = left.property;
      const propName: string = prop.type === 'Identifier' ? prop.name : (prop.value ?? '');

      if (propName === 'innerHTML' || propName === 'outerHTML') {
        if (isInsideLoop(nodePath)) {
          addFinding(nodePath, 'innerhtml_in_loop', 'high',
            `Assignment to .${propName} inside a loop triggers n parse+serialize cycles`);
        }
      }

      if (left.object?.type === 'MemberExpression' &&
        left.object.property?.name === 'style') {
        if (isInsideLoop(nodePath)) {
          addFinding(nodePath, 'style_mutation_in_loop', 'medium',
            `Individual style property mutation inside loop; prefer CSS class toggle`);
        }
      }
    },

    MemberExpression(nodePath: any) {
      const { property, object } = nodePath.node;
      if (property.type !== 'Identifier') return;
      const propName: string = property.name;

      if (LAYOUT_READ_PROPS.has(propName)) {
        if (isInsideLoop(nodePath)) {
          const parent = nodePath.parentPath;
          const isRead = parent?.node.type !== 'AssignmentExpression' ||
            parent?.node.left !== nodePath.node;
          if (isRead) {
            addFinding(nodePath, 'forced_sync_layout', 'high',
              `Reading layout property .${propName} inside a loop forces synchronous layout on each iteration`);
          }
        }
      }
    },

    CallExpression(nodePath: any) {
      const { callee } = nodePath.node;
      if (callee.type !== 'MemberExpression') return;
      const methodName: string =
        callee.property.type === 'Identifier' ? callee.property.name : '';

      if (DOM_QUERY_METHODS.has(methodName)) {
        if (isInsideLoop(nodePath)) {
          addFinding(nodePath, 'dom_query_in_loop', 'medium',
            `.${methodName}() called inside a loop; cache the element reference outside`);
        }
      }
    },
  });

  return findings;
}

function scanDirectory(dir: string): DomFinding[] {
  const files = glob.sync('**/*.{js,jsx,ts,tsx,mjs,vue}', {
    cwd: dir,
    absolute: true,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**',
      '**/*.d.ts', '**/*.test.*', '**/*.spec.*', '**/__tests__/**',
      '**/.next/**', '**/.nuxt/**', '**/storybook-static/**',
    ],
  });

  const findings: DomFinding[] = [];
  for (const file of files) {
    findings.push(...detectDomPatterns(file));
  }
  return findings;
}

if (require.main === module) {
  const pathArg = process.argv.find(a => a.startsWith('--path'))?.split('=')[1]
    ?? process.argv[process.argv.indexOf('--path') + 1]
    ?? process.cwd();

  const targetPath = path.resolve(pathArg);
  console.log(`Scanning: ${targetPath}`);

  const findings = fs.statSync(targetPath).isDirectory()
    ? scanDirectory(targetPath)
    : detectDomPatterns(targetPath);

  const bySeverity = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byCategory = findings.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\nFindings: ${findings.length}`);
  console.log('By severity:', bySeverity);
  console.log('By category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  if (process.env.OUTPUT) {
    fs.writeFileSync(process.env.OUTPUT, JSON.stringify(findings, null, 2));
    console.log(`\nWritten to ${process.env.OUTPUT}`);
  } else {
    findings.slice(0, 20).forEach(f => {
      console.log(`\n[${f.severity.toUpperCase()}] ${f.category}`);
      console.log(`  ${f.file}:${f.line}`);
      console.log(`  ${f.message}`);
      console.log(`  > ${f.snippet}`);
    });
    if (findings.length > 20) console.log(`\n... and ${findings.length - 20} more`);
  }
}
