// Adapted from Code Evolution Lab — backend/src/analyzer/parser.ts
import * as parser from '@babel/parser';

export function parseCode(sourceCode: string): any {
  return parser.parse(sourceCode, {
    sourceType: 'module',
    plugins: [
      'typescript',
      'jsx',
      'decorators-legacy',
      'classProperties',
      'asyncGenerators',
      'dynamicImport',
      'optionalChaining',
      'nullishCoalescingOperator',
    ],
    errorRecovery: true, // Don't crash on parse errors — skip and continue
  });
}
