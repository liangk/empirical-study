/**
 * Study 03 — Shared Detection Utilities
 *
 * Helper functions used by all three framework detectors (React, Vue, Angular).
 * Includes AST ancestry inspection, code snippet extraction, ID generation,
 * and common pattern matchers for event listeners, timers, and subscriptions.
 *
 * Adapted from Code Evolution Lab's shared analysis utilities.
 */

import type { ScanIssue, LeakContext, Framework } from './types';

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

/** Generate a unique-per-run identifier for each scan issue. */
export function generateId(): string {
  return `ml-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

// ---------------------------------------------------------------------------
// Source snippet extraction
// ---------------------------------------------------------------------------

/** Extract a compact code snippet from an AST node's source range. */
export function getCode(node: any, sourceCode: string, maxLen = 200): string {
  if (!node.start || !node.end) return '';
  const raw = sourceCode.slice(node.start, node.end);
  return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw;
}

// ---------------------------------------------------------------------------
// AST ancestry helpers
// ---------------------------------------------------------------------------

/** Walk up the AST to find the name of the enclosing component or function. */
export function getEnclosingComponentName(path: any): string | undefined {
  let current = path.parentPath;
  while (current) {
    const node = current.node;
    if (!node) break;

    // function MyComponent() { ... }
    if (node.type === 'FunctionDeclaration' && node.id?.name) {
      return node.id.name;
    }
    // const MyComponent = () => { ... }  or  const MyComponent = function() { ... }
    if (
      (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') &&
      current.parentPath?.node?.type === 'VariableDeclarator'
    ) {
      return current.parentPath.node.id?.name;
    }
    // class MyComponent { ... }
    if (node.type === 'ClassDeclaration' && node.id?.name) {
      return node.id.name;
    }
    // Angular/Vue: export default { name: 'X', ... }
    if (node.type === 'ObjectExpression' && current.parentPath?.node?.type === 'ExportDefaultDeclaration') {
      const nameProp = node.properties?.find(
        (p: any) => p.key?.name === 'name' && p.value?.type === 'StringLiteral'
      );
      if (nameProp) return nameProp.value.value;
    }
    current = current.parentPath;
  }
  return undefined;
}

/**
 * Check whether a CallExpression's callee matches a given name.
 * Handles both direct calls `foo()` and member calls `obj.foo()`.
 */
export function isCallTo(node: any, name: string): boolean {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = node.callee;
  // Direct call: foo()
  if (callee?.type === 'Identifier' && callee.name === name) return true;
  // Member call: obj.foo()
  if (callee?.type === 'MemberExpression' && callee.property?.name === name) return true;
  return false;
}

/**
 * Check whether a CallExpression's callee matches any name in the set.
 */
export function isCallToAny(node: any, names: string[]): boolean {
  return names.some(n => isCallTo(node, n));
}

/**
 * Extract the method name from a CallExpression callee.
 * Returns the property name for member expressions, or the identifier name.
 */
export function getCallName(node: any): string | undefined {
  if (!node || node.type !== 'CallExpression') return undefined;
  const callee = node.callee;
  if (callee?.type === 'Identifier') return callee.name;
  if (callee?.type === 'MemberExpression') return callee.property?.name;
  return undefined;
}

// ---------------------------------------------------------------------------
// Common leak pattern matchers
// ---------------------------------------------------------------------------

/** Timer setup calls that need cleanup. */
export const TIMER_SETUP_CALLS = ['setInterval', 'setTimeout', 'requestAnimationFrame'];

/** Timer cleanup calls that correspond to setup calls. */
export const TIMER_CLEANUP_MAP: Record<string, string> = {
  setInterval: 'clearInterval',
  setTimeout: 'clearTimeout',
  requestAnimationFrame: 'cancelAnimationFrame',
};

/** Observer APIs that need .disconnect(). */
export const OBSERVER_APIS = ['IntersectionObserver', 'MutationObserver', 'ResizeObserver', 'PerformanceObserver'];

/**
 * Check if the given function body contains a call to a specific cleanup method.
 * Uses a simple text search on the raw source for speed — not AST-precise,
 * but sufficient for the heuristic-based study approach.
 */
export function bodyContainsCall(sourceCode: string, node: any, callName: string): boolean {
  if (!node.start || !node.end) return false;
  const body = sourceCode.slice(node.start, node.end);
  return body.includes(callName);
}

/**
 * Check whether an arrow/function body contains a return statement
 * (used to check if useEffect has a cleanup return).
 */
export function hasReturnStatement(path: any): boolean {
  let found = false;

  // Some callers (React detector with noScope: true) operate without Babel scope
  // context. If traverse attempts to descend into a child path without a parent
  // scope it throws. Fall back to manual source inspection in that case.
  try {
    path.traverse({
      ReturnStatement() { found = true; },
      // Don't recurse into nested functions — their returns don't count.
      ArrowFunctionExpression(innerPath: any) { innerPath.skip(); },
      FunctionExpression(innerPath: any) { innerPath.skip(); },
      FunctionDeclaration(innerPath: any) { innerPath.skip(); },
    });
    return found;
  } catch (err) {
    const node = path.node;
    if (!node?.body) return false;
    const bodyNode = node.body;
    if (!bodyNode.start || !bodyNode.end) return false;
    const source: string = path.hub?.file?.code || path.hub?.getCode?.() || '';
    if (!source) return false;
    const bodyText = source.slice(bodyNode.start, bodyNode.end);
    return /return\s/.test(bodyText);
  }
}

/**
 * Determine leak context from file path heuristics.
 * Falls back to 'unknown' if no hint matches.
 */
export function classifyContextFromPath(filePath: string): LeakContext {
  const lower = filePath.toLowerCase().replace(/\\/g, '/');

  // Service / provider files are usually singletons
  if (/\/(services?|providers?|api|http)\//i.test(lower) || /\.(service|provider)\.[jt]sx?$/.test(lower)) {
    return 'service_singleton';
  }
  // Store / state management files
  if (/\/(store|stores|state|redux|slices?|reducers?|actions?|selectors?|pinia)\//i.test(lower)) {
    return 'store_subscription';
  }
  // Component files — the most common location
  if (/\/(components?|pages?|views?|screens?|layouts?|containers?)\//i.test(lower)) {
    return 'component_lifecycle';
  }
  // Hook / composable files
  if (/\/(hooks?|composables?|use[A-Z])\//i.test(lower) || /\/use[A-Z][^/]*\.[jt]sx?$/.test(lower)) {
    return 'component_lifecycle';
  }
  return 'unknown';
}

/**
 * Determine framework from file path, imports, or content heuristics.
 */
export function detectFramework(sourceCode: string, filePath: string): Framework {
  const lower = filePath.toLowerCase();

  // Angular: decorator-based components
  if (sourceCode.includes('@Component') || sourceCode.includes('@Injectable') || /\.component\.[jt]s$/.test(lower)) {
    return 'angular';
  }
  // Vue: .vue files or defineComponent / setup()
  if (/\.vue$/.test(lower) || sourceCode.includes('defineComponent') || sourceCode.includes('onMounted')) {
    return 'vue';
  }
  // React: JSX/TSX or React imports
  if (/\.[jt]sx$/.test(lower) || sourceCode.includes('useEffect') || sourceCode.includes('from \'react\'') || sourceCode.includes('from "react"')) {
    return 'react';
  }
  return 'unknown';
}
