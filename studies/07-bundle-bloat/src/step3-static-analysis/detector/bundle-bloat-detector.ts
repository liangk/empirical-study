/**
 * Study 07: Bundle Bloat Detector
 *
 * Detects non-tree-shakeable import patterns in frontend JavaScript/TypeScript source files.
 *
 * Detection categories:
 *   moment_import        - import moment from 'moment' (67KB gzipped, non-tree-shakeable)
 *   full_lodash_import   - import _ from 'lodash' (25KB gzipped, use lodash-es named imports)
 *   barrel_import        - import { X } from '@mui/material' / 'antd' / '@chakra-ui/react'
 *   namespace_import     - import * as X from 'known-large-library'
 *   cjs_require          - require('lodash') / require('moment') in ESM source files
 */

import * as fs from 'fs';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { glob } from 'glob';

export type LeakCategory =
  | 'moment_import'
  | 'full_lodash_import'
  | 'barrel_import'
  | 'namespace_import'
  | 'cjs_require';

export type Severity = 'high' | 'medium';

export interface BloatFinding {
  file: string;
  line: number;
  category: LeakCategory;
  severity: Severity;
  description: string;
  suggestion: string;
}

const MAX_FILE_SIZE_BYTES = 1_000_000;

const MOMENT_PACKAGES = new Set(['moment', 'moment-timezone']);

const LODASH_PACKAGES = new Set(['lodash', 'underscore']);

const BARREL_PACKAGES = new Set([
  '@mui/material',
  '@mui/icons-material',
  '@mui/lab',
  'antd',
  '@ant-design/icons',
  '@chakra-ui/react',
  '@mantine/core',
  '@mantine/hooks',
  '@headlessui/react',
  '@heroicons/react',
  'react-bootstrap',
  'reactstrap',
  'semantic-ui-react',
  'grommet',
  'evergreen-ui',
  'rsuite',
  'primereact',
]);

const NAMESPACE_HEAVY_PACKAGES = new Set([
  'lodash',
  'lodash-es',
  'underscore',
  'rxjs',
  'rxjs/operators',
  'd3',
  'three',
  'react-icons/fa',
  'react-icons/md',
  'react-icons/io',
  'react-icons/hi',
  'react-icons/bi',
  'react-icons/bs',
  '@fortawesome/free-solid-svg-icons',
  '@fortawesome/free-regular-svg-icons',
  '@fortawesome/free-brands-svg-icons',
]);

const CJS_HEAVY_PACKAGES = new Set([
  'lodash',
  'moment',
  'moment-timezone',
  'underscore',
  'jquery',
  '@mui/material',
  'antd',
]);

function parseFile(filePath: string): any | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE_BYTES) return null;
    const code = fs.readFileSync(filePath, 'utf8');
    return parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy', 'classProperties'],
      errorRecovery: true,
    });
  } catch {
    return null;
  }
}

export function detectBloat(filePath: string): BloatFinding[] {
  const ast = parseFile(filePath);
  if (!ast) return [];

  const findings: BloatFinding[] = [];
  const rel = filePath;

  try {
    traverse(ast, {
      ImportDeclaration(nodePath) {
        const source = nodePath.node.source.value;
        const specifiers = nodePath.node.specifiers;
        const line = nodePath.node.loc?.start.line ?? 0;

        if (MOMENT_PACKAGES.has(source)) {
          const hasDefault = specifiers.some(s => s.type === 'ImportDefaultSpecifier');
          const hasNamespace = specifiers.some(s => s.type === 'ImportNamespaceSpecifier');
          if (hasDefault || hasNamespace || specifiers.length === 0) {
            findings.push({
              file: rel, line, category: 'moment_import', severity: 'high',
              description: `Full import of '${source}' (~67 KB gzipped). moment.js is non-tree-shakeable.`,
              suggestion: `Replace with 'dayjs' (~2 KB) or tree-shakeable 'date-fns' named imports.`,
            });
          }
          return;
        }

        if (LODASH_PACKAGES.has(source)) {
          const hasDefault = specifiers.some(s => s.type === 'ImportDefaultSpecifier');
          const hasNamespace = specifiers.some(s => s.type === 'ImportNamespaceSpecifier');
          if (hasDefault || hasNamespace) {
            findings.push({
              file: rel, line, category: 'full_lodash_import', severity: 'high',
              description: `Full default import of '${source}' (~25 KB gzipped). Ships entire library.`,
              suggestion: `Use named imports from 'lodash-es': import { debounce } from 'lodash-es'`,
            });
          }
          return;
        }

        if (BARREL_PACKAGES.has(source)) {
          const namedSpecifiers = specifiers.filter(s => s.type === 'ImportSpecifier');
          if (namedSpecifiers.length > 0) {
            const names = namedSpecifiers.map((s: any) => s.imported?.name ?? '').join(', ');
            findings.push({
              file: rel, line, category: 'barrel_import', severity: 'medium',
              description: `Barrel import from '${source}': { ${names} }. May prevent tree-shaking without bundler config.`,
              suggestion: `Use direct path imports: import ${(namedSpecifiers[0] as any).imported?.name} from '${source}/${(namedSpecifiers[0] as any).imported?.name}'`,
            });
          }
          return;
        }

        const hasNamespace = specifiers.some(s => s.type === 'ImportNamespaceSpecifier');
        if (hasNamespace && NAMESPACE_HEAVY_PACKAGES.has(source)) {
          const alias = (specifiers.find(s => s.type === 'ImportNamespaceSpecifier') as any)?.local?.name ?? 'X';
          findings.push({
            file: rel, line, category: 'namespace_import', severity: 'medium',
            description: `Namespace import 'import * as ${alias} from "${source}"' imports everything from the library.`,
            suggestion: `Use named imports instead: import { specificExport } from '${source}'`,
          });
        }
      },

      CallExpression(nodePath) {
        const callee = nodePath.node.callee;
        if (callee.type !== 'Identifier' || callee.name !== 'require') return;
        const args = nodePath.node.arguments;
        if (args.length === 0 || args[0].type !== 'StringLiteral') return;
        const source = (args[0] as any).value as string;
        if (!CJS_HEAVY_PACKAGES.has(source)) return;

        const line = nodePath.node.loc?.start.line ?? 0;
        findings.push({
          file: rel, line, category: 'cjs_require', severity: 'medium',
          description: `CommonJS require('${source}') prevents tree-shaking in ESM bundles.`,
          suggestion: `Replace with ESM import: import { ... } from '${source === 'lodash' ? 'lodash-es' : source}'`,
        });
      },
    });
  } catch { }

  return findings;
}

export function scanDirectory(dirPath: string): BloatFinding[] {
  const files = glob.sync('**/*.{ts,tsx,js,jsx,mts,mjs}', {
    cwd: dirPath,
    absolute: true,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
    ],
  });

  const findings: BloatFinding[] = [];
  for (const file of files) {
    findings.push(...detectBloat(file));
  }
  return findings;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const pathArg = args.findIndex(a => a === '--path');
  const targetPath = pathArg !== -1 ? args[pathArg + 1] : process.cwd();

  const findings = scanDirectory(targetPath);

  if (findings.length === 0) {
    console.log('No bundle bloat patterns detected.');
    process.exit(0);
  }

  const bySeverity: Record<Severity, BloatFinding[]> = { high: [], medium: [] };
  for (const f of findings) bySeverity[f.severity].push(f);

  for (const severity of ['high', 'medium'] as Severity[]) {
    for (const f of bySeverity[severity]) {
      console.log(`\n[${severity.toUpperCase()}] ${f.category}`);
      console.log(`  ${f.file}:${f.line}`);
      console.log(`  ${f.description}`);
      console.log(`  → ${f.suggestion}`);
    }
  }

  console.log(`\n${findings.length} finding(s): ${bySeverity.high.length} high, ${bySeverity.medium.length} medium`);
}
