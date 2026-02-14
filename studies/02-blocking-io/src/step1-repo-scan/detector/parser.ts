// Adapted from Code Evolution Lab — backend/src/analyzer/parser.ts
//
// Purpose:
// Parse many heterogeneous JavaScript/TypeScript codebases without failing hard.
// This is intentionally permissive because empirical scanning should continue even
// if a few files are malformed, partially generated, or use edge-case syntax.
import * as parser from '@babel/parser';

export function parseCode(sourceCode: string): any {
  // We parse as ESM module by default; Babel still tolerates most mixed code.
  return parser.parse(sourceCode, {
    sourceType: 'module',
    plugins: [
      // TypeScript + JSX covers the majority of modern Node/React stacks.
      'typescript',
      'jsx',
      // Keep legacy decorators support to handle older transpiled repositories.
      'decorators-legacy',
      'classProperties',
      'asyncGenerators',
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
    // Critical for large-scale scans: recover from parse errors instead of crashing.
    // Downstream logic can still inspect parsable portions of the AST.
    errorRecovery: true,
  });
}
