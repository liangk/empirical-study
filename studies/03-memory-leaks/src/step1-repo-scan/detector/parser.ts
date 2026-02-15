/**
 * Study 03 — Babel Parser Configuration
 *
 * Parses JavaScript/TypeScript source into an AST for memory leak detection.
 * Adapted from Study 02 (blocking-io) with identical plugin set to handle
 * the full range of modern JS/TS syntax found in React, Vue, and Angular repos.
 *
 * Key design choice: errorRecovery is enabled so that malformed or partially
 * generated files don't crash the scanner. In a large-scale empirical scan,
 * maximising file coverage is more important than strict parse correctness.
 */

import { parse } from '@babel/parser';

export function parseCode(code: string, filePath: string = 'unknown.ts') {
  const isTS = /\.tsx?$/.test(filePath);
  const isJSX = /\.[jt]sx$/.test(filePath);

  const plugins: any[] = [
    'decorators-legacy',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'dynamicImport',
    'nullishCoalescingOperator',
    'optionalChaining',
    'numericSeparator',
    'objectRestSpread',
    'asyncGenerators',
    'topLevelAwait',
  ];

  if (isTS) plugins.push('typescript');
  if (isJSX || isTS) plugins.push('jsx');

  return parse(code, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    errorRecovery: true,
    plugins,
  });
}
