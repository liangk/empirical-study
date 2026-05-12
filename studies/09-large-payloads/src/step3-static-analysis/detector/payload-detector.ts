// Large Payload Anti-Pattern Detector for Study 09
// Babel AST detector for unbounded queries and missing pagination

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface Finding {
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  file: string;
  line: number;
  code: string;
  description: string;
}

const PATTERNS = {
  // Prisma: findMany() without take/where
  unbounded_find_all: {
    severity: 'high' as const,
    description: 'Unbounded findMany/findAll without limit',
  },
  // SQL SELECT *
  select_star: {
    severity: 'high' as const,
    description: 'SELECT * without column list',
  },
  // Missing pagination in API endpoint
  missing_pagination: {
    severity: 'high' as const,
    description: 'Endpoint without pagination (limit/offset or cursor)',
  },
  // Deep nested Prisma include
  deep_nested_include: {
    severity: 'medium' as const,
    description: 'Deep nested include (3+ levels) inflates payload',
  },
  // GraphQL resolver returning array without pagination
  unbounded_graphql: {
    severity: 'high' as const,
    description: 'GraphQL resolver returning unbounded array',
  },
};

export function detectInFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');

  // Skip non-JS/TS files
  if (!/\.(ts|js|tsx|jsx)$/.test(filePath)) {
    return findings;
  }

  let ast: t.File;
  try {
    ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
  } catch {
    return findings;
  }

  traverse(ast, {
    // Prisma: findMany() without take
    CallExpression(nodePath) {
      const callee = nodePath.node.callee;
      if (t.isMemberExpression(callee)) {
        const method = t.isIdentifier(callee.property) ? callee.property.name : '';
        const args = nodePath.node.arguments;

        // Prisma findMany, findFirst, findMany without take
        if (['findMany', 'findFirst', 'find', 'findAll'].includes(method)) {
          if (args.length === 0 || !hasLimit(args[0])) {
            findings.push({
              pattern: 'unbounded_find_all',
              severity: PATTERNS.unbounded_find_all.severity,
              file: filePath,
              line: nodePath.node.loc?.start.line || 0,
              code: content.split('\n')[nodePath.node.loc?.start.line ? nodePath.node.loc.start.line - 1 : 0]?.trim() || '',
              description: PATTERNS.unbounded_find_all.description,
            });
          }
        }

        // Prisma include with 3+ levels
        if (method === 'include' || (args.length > 0 && hasDeepInclude(args[0]))) {
          findings.push({
            pattern: 'deep_nested_include',
            severity: PATTERNS.deep_nested_include.severity,
            file: filePath,
            line: nodePath.node.loc?.start.line || 0,
            code: content.split('\n')[nodePath.node.loc?.start.line ? nodePath.node.loc.start.line - 1 : 0]?.trim() || '',
            description: PATTERNS.deep_nested_include.description,
          });
        }
      }
    },

    // SQL SELECT * detection
    StringLiteral(nodePath) {
      const value = nodePath.node.value;
      if (/SELECT\s+\*\s+FROM/i.test(value)) {
        findings.push({
          pattern: 'select_star',
          severity: PATTERNS.select_star.severity,
          file: filePath,
          line: nodePath.node.loc?.start.line || 0,
          code: value.slice(0, 50) + '...',
          description: PATTERNS.select_star.description,
        });
      }
    },

    TemplateElement(nodePath) {
      const value = nodePath.node.value.raw;
      if (/SELECT\s+\*\s+FROM/i.test(value)) {
        findings.push({
          pattern: 'select_star',
          severity: PATTERNS.select_star.severity,
          file: filePath,
          line: nodePath.node.loc?.start.line || 0,
          code: value.slice(0, 50) + '...',
          description: PATTERNS.select_star.description,
        });
      }
    },
  });

  return findings;
}

function hasLimit(arg: t.Node | null | undefined): boolean {
  if (!arg || !t.isObjectExpression(arg)) return false;
  
  for (const prop of arg.properties) {
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
      if (['take', 'limit', 'where'].includes(prop.key.name)) {
        return true;
      }
    }
  }
  return false;
}

function hasDeepInclude(arg: t.Node | null | undefined): boolean {
  if (!arg || !t.isObjectExpression(arg)) return false;
  
  function countNesting(obj: t.ObjectExpression, depth: number): number {
    let maxDepth = depth;
    for (const prop of obj.properties) {
      if (t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
        maxDepth = Math.max(maxDepth, countNesting(prop.value, depth + 1));
      }
    }
    return maxDepth;
  }

  return countNesting(arg, 1) >= 3;
}

export async function detectPayloadPatterns(dir: string): Promise<Finding[]> {
  const files = await glob('**/*.{ts,js,tsx,jsx}', {
    cwd: dir,
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  const allFindings: Finding[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const findings = detectInFile(filePath);
    allFindings.push(...findings);
  }

  return allFindings;
}

// CLI entry point
async function main() {
  const targetPath = process.argv.find(a => a.startsWith('--path'))?.split('=')[1] || process.cwd();
  console.log(`Scanning ${targetPath} for large payload patterns...`);
  
  const findings = await detectPayloadPatterns(targetPath);
  
  console.log(`\nFound ${findings.length} issues:`);
  
  const byPattern: Record<string, number> = {};
  for (const f of findings) {
    byPattern[f.pattern] = (byPattern[f.pattern] || 0) + 1;
  }
  
  for (const [pattern, count] of Object.entries(byPattern).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pattern}: ${count}`);
  }

  console.log('\nTop 10 files by findings:');
  const byFile: Record<string, number> = {};
  for (const f of findings) {
    byFile[f.file] = (byFile[f.file] || 0) + 1;
  }
  for (const [file, count] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`  ${file}: ${count}`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
