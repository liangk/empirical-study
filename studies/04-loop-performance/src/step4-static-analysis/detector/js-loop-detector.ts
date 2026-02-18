import * as parser from '@babel/parser';
import traverse, { type NodePath, type Visitor } from '@babel/traverse';
import * as t from '@babel/types';
import { readFileSync } from 'fs';

export type AntiPatternKind =
  | 'regex-in-loop'
  | 'json-parse-in-loop'
  | 'nested-loops'
  | 'nested-array-methods'
  | 'chained-array-methods'
  | 'sequential-await-in-loop';

export interface LoopIssue {
  file: string;
  line: number;
  column: number;
  kind: AntiPatternKind;
  description: string;
  severity: 'high' | 'medium' | 'low';
  snippet: string;
}

const ARRAY_METHODS = new Set(['forEach', 'map', 'filter', 'reduce', 'find', 'findIndex', 'some', 'every', 'flatMap']);
const CHAINING_SOURCE = new Set(['filter', 'map']);
const CHAINING_TARGET = new Set(['map', 'filter', 'reduce', 'forEach']);

function snippetAt(code: string, line: number): string {
  const lines = code.split('\n');
  return (lines[line - 1] ?? '').trim().slice(0, 120);
}

function isInsideLoop(path: { parentPath: unknown }): boolean {
  let p = (path as { parentPath: { node?: { type?: string }; parentPath: unknown } | null }).parentPath;
  while (p && p.node) {
    const type = p.node.type ?? '';
    if (['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'].includes(type)) return true;
    if (type === 'CallExpression') {
      const callee = (p.node as t.CallExpression).callee;
      if (t.isMemberExpression(callee) && t.isIdentifier(callee.property) && ARRAY_METHODS.has(callee.property.name)) return true;
    }
    p = (p as { parentPath: typeof p }).parentPath;
  }
  return false;
}

function countLoopDepth(path: { parentPath: unknown }): number {
  let depth = 0;
  let p = (path as { parentPath: { node?: { type?: string }; parentPath: unknown } | null }).parentPath;
  while (p && p.node) {
    const type = p.node.type ?? '';
    if (['ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement'].includes(type)) depth++;
    if (type === 'CallExpression') {
      const callee = (p.node as t.CallExpression).callee;
      if (t.isMemberExpression(callee) && t.isIdentifier(callee.property) && ARRAY_METHODS.has(callee.property.name)) depth++;
    }
    p = (p as { parentPath: typeof p }).parentPath;
  }
  return depth;
}

export function detectIssues(filePath: string): LoopIssue[] {
  let code: string;
  try { code = readFileSync(filePath, 'utf-8'); } catch { return []; }

  let ast: t.File;
  try {
    ast = parser.parse(code, {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch { return []; }

  const issues: LoopIssue[] = [];

  const visitor = {
    noScope: true,
    RegExpLiteral(path: NodePath<t.RegExpLiteral>) {
      if (!isInsideLoop(path)) return;
      const loc = path.node.loc?.start;
      if (!loc) return;
      issues.push({
        file: filePath, line: loc.line, column: loc.column,
        kind: 'regex-in-loop',
        description: 'Regex literal inside loop — compiled on every iteration. Hoist outside loop.',
        severity: 'high',
        snippet: snippetAt(code, loc.line),
      });
    },

    NewExpression(path: NodePath<t.NewExpression>) {
      if (!t.isIdentifier(path.node.callee, { name: 'RegExp' })) return;
      if (!isInsideLoop(path)) return;
      const loc = path.node.loc?.start;
      if (!loc) return;
      issues.push({
        file: filePath, line: loc.line, column: loc.column,
        kind: 'regex-in-loop',
        description: 'new RegExp() inside loop — recompiled on every iteration. Hoist outside loop.',
        severity: 'high',
        snippet: snippetAt(code, loc.line),
      });
    },

    CallExpression(path: NodePath<t.CallExpression>) {
      const { node } = path;
      const loc = node.loc?.start;
      if (!loc) return;

      if (t.isMemberExpression(node.callee)) {
        const prop = node.callee.property;
        if (t.isIdentifier(prop, { name: 'parse' })) {
          const obj = node.callee.object;
          if (t.isIdentifier(obj, { name: 'JSON' }) && isInsideLoop(path)) {
            issues.push({
              file: filePath, line: loc.line, column: loc.column,
              kind: 'json-parse-in-loop',
              description: 'JSON.parse() inside loop — parse once before the loop and reuse result.',
              severity: 'high',
              snippet: snippetAt(code, loc.line),
            });
          }
        }

        if (t.isIdentifier(prop) && ARRAY_METHODS.has(prop.name)) {
          const depth = countLoopDepth(path);
          if (depth >= 2) {
            issues.push({
              file: filePath, line: loc.line, column: loc.column,
              kind: 'nested-array-methods',
              description: `Array .${prop.name}() at loop depth ${depth} — consider flattening to single-pass loop.`,
              severity: 'medium',
              snippet: snippetAt(code, loc.line),
            });
          }

          if (
            t.isMemberExpression(node.callee.object) &&
            t.isCallExpression(node.callee.object) &&
            t.isMemberExpression((node.callee.object as t.CallExpression).callee)
          ) {
            const innerCallee = (node.callee.object as t.CallExpression).callee as t.MemberExpression;
            if (t.isIdentifier(innerCallee.property) &&
                CHAINING_SOURCE.has(innerCallee.property.name) &&
                CHAINING_TARGET.has(prop.name)) {
              issues.push({
                file: filePath, line: loc.line, column: loc.column,
                kind: 'chained-array-methods',
                description: `Chained .${innerCallee.property.name}().${prop.name}() — two passes + intermediate array. Consider .reduce() or single for-loop.`,
                severity: 'medium',
                snippet: snippetAt(code, loc.line),
              });
            }
          }
        }
      }

      if (t.isAwaitExpression(path.parent) && isInsideLoop(path)) {
        issues.push({
          file: filePath, line: loc.line, column: loc.column,
          kind: 'sequential-await-in-loop',
          description: 'await inside loop — sequential async I/O. Replace with Promise.all() for parallel execution.',
          severity: 'high',
          snippet: snippetAt(code, loc.line),
        });
      }
    },

    ForStatement(path: NodePath<t.ForStatement>) {
      const depth = countLoopDepth(path);
      if (depth >= 2) {
        const loc = path.node.loc?.start;
        if (!loc) return;
        issues.push({
          file: filePath, line: loc.line, column: loc.column,
          kind: 'nested-loops',
          description: `Nested for-loop at depth ${depth + 1} — potential O(n²). Consider Map/Set substitution.`,
          severity: 'high',
          snippet: snippetAt(code, loc.line),
        });
      }
    },

    ForOfStatement(path: NodePath<t.ForOfStatement>) {
      const depth = countLoopDepth(path);
      if (depth >= 2) {
        const loc = path.node.loc?.start;
        if (!loc) return;
        issues.push({
          file: filePath, line: loc.line, column: loc.column,
          kind: 'nested-loops',
          description: `Nested for-of at depth ${depth + 1} — potential O(n²). Consider Map/Set substitution.`,
          severity: 'high',
          snippet: snippetAt(code, loc.line),
        });
      }
    },
  } as Visitor;

  try {
    traverse(ast, visitor);
  } catch {
    return [];
  }

  return issues;
}
