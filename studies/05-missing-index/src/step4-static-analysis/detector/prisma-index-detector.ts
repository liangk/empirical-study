import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

/**
 * Static detector for missing index patterns in Prisma schemas and query call sites.
 *
 * Detection categories:
 *   missing-fk-index     — FK field (e.g. userId Int) without @@index
 *   missing-filter-index — Field used in findMany/findFirst where clause without @@index
 *   missing-sort-index   — Field used in orderBy without @@index
 *   missing-composite    — Multiple fields used together in where without composite @@index
 */

export interface IndexIssue {
  file: string;
  line: number;
  category: 'missing-fk-index' | 'missing-filter-index' | 'missing-sort-index' | 'missing-composite';
  severity: 'high' | 'medium';
  model?: string;
  field?: string;
  description: string;
  recommendation: string;
}

interface ModelInfo {
  name: string;
  fields: Map<string, { type: string; isFk: boolean }>;
  indexedFields: Set<string>;
  compositeIndexes: string[][];
}

function parseSchema(schemaContent: string): Map<string, ModelInfo> {
  const models = new Map<string, ModelInfo>();
  const lines = schemaContent.split('\n');
  let current: ModelInfo | null = null;
  let inModel = false;

  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      current = { name: modelMatch[1], fields: new Map(), indexedFields: new Set(), compositeIndexes: [] };
      models.set(current.name, current);
      inModel = true;
      continue;
    }
    if (line.match(/^\}/) && inModel) { inModel = false; current = null; continue; }
    if (!inModel || !current) continue;

    // @@index([field1, field2])
    const idxMatch = line.match(/@@index\s*\(\s*\[([^\]]+)\]/);
    if (idxMatch) {
      const fields = idxMatch[1].split(',').map(f => f.trim().split('(')[0].trim());
      fields.forEach(f => current!.indexedFields.add(f));
      if (fields.length > 1) current.compositeIndexes.push(fields);
      continue;
    }

    // @unique implies index
    if (line.match(/@unique/) || line.match(/@id/)) {
      const fieldMatch = line.match(/^\s+(\w+)\s+/);
      if (fieldMatch) current.indexedFields.add(fieldMatch[1]);
      continue;
    }

    // Field declaration: name Type @modifiers
    const fieldMatch = line.match(/^\s+(\w+)\s+([\w\[\]?]+)/);
    if (fieldMatch) {
      const [, fieldName, fieldType] = fieldMatch;
      const isFk = /Id$/.test(fieldName) && (fieldType === 'Int' || fieldType === 'String');
      current.fields.set(fieldName, { type: fieldType, isFk });
    }
  }

  return models;
}

function detectSchemaIssues(schemaPath: string): IndexIssue[] {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const models = parseSchema(content);
  const issues: IndexIssue[] = [];
  const lines = content.split('\n');

  for (const [, model] of models) {
    for (const [field, info] of model.fields) {
      if (info.isFk && !model.indexedFields.has(field)) {
        const lineNum = lines.findIndex(l => new RegExp(`\\b${field}\\b`).test(l) && l.includes(info.type)) + 1;
        issues.push({
          file: schemaPath, line: lineNum,
          category: 'missing-fk-index', severity: 'high',
          model: model.name, field,
          description: `FK '${field}' on model '${model.name}' has no @@index — Prisma does NOT auto-create FK indexes`,
          recommendation: `Add @@index([${field}]) to model '${model.name}'`,
        });
      }

      // Timestamp fields commonly used in orderBy
      if ((field === 'createdAt' || field === 'updatedAt') && !model.indexedFields.has(field)) {
        const lineNum = lines.findIndex(l => new RegExp(`\\b${field}\\b`).test(l) && l.includes('DateTime')) + 1;
        issues.push({
          file: schemaPath, line: lineNum,
          category: 'missing-sort-index', severity: 'medium',
          model: model.name, field,
          description: `'${field}' on '${model.name}' is commonly used in orderBy but has no @@index`,
          recommendation: `Add @@index([${field}(sort: Desc)]) to model '${model.name}'`,
        });
      }
    }
  }

  return issues;
}

function detectQueryIssues(tsFile: string, models: Map<string, ModelInfo>): IndexIssue[] {
  const content = fs.readFileSync(tsFile, 'utf8');
  const issues: IndexIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // prisma.modelName.findMany({ where: { field: value } })
    const findMatch = line.match(/prisma\.(\w+)\.(findMany|findFirst|findUnique)\(/);
    if (!findMatch) continue;

    const modelName = findMatch[1].charAt(0).toUpperCase() + findMatch[1].slice(1);
    const model = models.get(modelName);
    if (!model) continue;

    // Collect the next ~10 lines to parse the where block
    const block = lines.slice(i, i + 10).join('\n');

    // where: { field: ... }
    const whereFields = [...block.matchAll(/where:\s*\{([^}]+)\}/g)];
    if (whereFields.length > 0) {
      const fieldStr = whereFields[0][1];
      const usedFields = [...fieldStr.matchAll(/(\w+)\s*:/g)].map(m => m[1]).filter(f => f !== 'where');

      for (const field of usedFields) {
        if (model.fields.has(field) && !model.indexedFields.has(field)) {
          issues.push({
            file: tsFile, line: i + 1,
            category: 'missing-filter-index', severity: 'high',
            model: modelName, field,
            description: `Field '${field}' used in where clause for '${modelName}' but has no @@index in schema`,
            recommendation: `Add @@index([${field}]) to model '${modelName}' in schema.prisma`,
          });
        }
      }

      // Check for multi-field where without composite index
      if (usedFields.length >= 2) {
        const hasComposite = model.compositeIndexes.some(idx =>
          usedFields.every(f => idx.includes(f))
        );
        if (!hasComposite) {
          const indexedCount = usedFields.filter(f => model.indexedFields.has(f)).length;
          if (indexedCount < usedFields.length) {
            issues.push({
              file: tsFile, line: i + 1,
              category: 'missing-composite', severity: 'medium',
              model: modelName,
              description: `Multi-field where on '${modelName}' [${usedFields.join(', ')}] without composite @@index`,
              recommendation: `Add @@index([${usedFields.join(', ')}]) to model '${modelName}'`,
            });
          }
        }
      }
    }
  }

  return issues;
}

async function main() {
  const args = process.argv.slice(2);
  const pathFlag = args[args.indexOf('--path') + 1];
  const targetPath = pathFlag ?? process.cwd();

  console.log(`Prisma Index Detector — scanning: ${targetPath}\n`);

  // Find schema.prisma files
  const schemaFiles = glob.sync('**/schema.prisma', {
    cwd: targetPath, absolute: true,
    ignore: ['**/node_modules/**'],
  });

  let allModels = new Map<string, ModelInfo>();
  const schemaIssues: IndexIssue[] = [];

  for (const schema of schemaFiles) {
    console.log(`Schema: ${path.relative(targetPath, schema)}`);
    const issues = detectSchemaIssues(schema);
    schemaIssues.push(...issues);
    const schemaModels = parseSchema(fs.readFileSync(schema, 'utf8'));
    schemaModels.forEach((v, k) => allModels.set(k, v));
    console.log(`  ${issues.length} schema-level issues found`);
  }

  // Find TypeScript files with Prisma query calls
  const tsFiles = glob.sync('**/*.{ts,tsx}', {
    cwd: targetPath, absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts'],
  });

  const queryIssues: IndexIssue[] = [];
  for (const tsFile of tsFiles) {
    const issues = detectQueryIssues(tsFile, allModels);
    if (issues.length > 0) {
      console.log(`${path.relative(targetPath, tsFile)}: ${issues.length} query-level issues`);
      queryIssues.push(...issues);
    }
  }

  const allIssues = [...schemaIssues, ...queryIssues];

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Schema files scanned: ${schemaFiles.length}`);
  console.log(`TypeScript files scanned: ${tsFiles.length}`);
  console.log(`Total issues: ${allIssues.length}`);

  const byCat = new Map<string, number>();
  for (const iss of allIssues) byCat.set(iss.category, (byCat.get(iss.category) ?? 0) + 1);
  for (const [cat, count] of byCat) console.log(`  ${cat}: ${count}`);

  // Print findings
  if (allIssues.length > 0) {
    console.log('\n=== Findings ===');
    for (const iss of allIssues.slice(0, 20)) {
      console.log(`[${iss.severity.toUpperCase()}] ${iss.category}`);
      console.log(`  ${path.relative(targetPath, iss.file)}:${iss.line}`);
      console.log(`  ${iss.description}`);
      console.log(`  Fix: ${iss.recommendation}\n`);
    }
    if (allIssues.length > 20) console.log(`... and ${allIssues.length - 20} more`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
