import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadCorpus, CorpusRepo } from './corpus';

const REPOS_DIR = path.join(__dirname, '..', '..', '.repos');
const RESULTS_DIR = path.join(__dirname, '..', '..', 'results');

export interface IndexFinding {
  repo: string;
  domain: string;
  orm: string;
  file: string;
  line: number;
  patternType: string;
  model?: string;
  field?: string;
  description: string;
}

function cloneRepo(repo: CorpusRepo): string {
  const repoDir = path.join(REPOS_DIR, repo.repo.replace('/', '__'));
  if (!fs.existsSync(repoDir)) {
    console.log(`  Cloning ${repo.repo}...`);
    execSync(`git clone --depth 1 ${repo.url} "${repoDir}"`, { stdio: 'pipe' });
  } else {
    console.log(`  Already cloned: ${repo.repo}`);
  }
  return repoDir;
}

function scanPrismaSchema(schemaPath: string, repo: CorpusRepo): IndexFinding[] {
  const findings: IndexFinding[] = [];
  const content = fs.readFileSync(schemaPath, 'utf8');
  const lines = content.split('\n');

  let currentModel = '';
  const modelFields = new Map<string, string[]>(); // field -> types
  const declaredIndexes = new Set<string>();
  let inModel = false;

  // First pass: collect model fields and declared indexes
  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) { currentModel = modelMatch[1]; inModel = true; modelFields.set(currentModel, []); continue; }
    if (line.match(/^\}/) && inModel) { inModel = false; continue; }
    if (!inModel) continue;

    // Track @@index declarations
    const indexMatch = line.match(/@@index\s*\(\s*\[([^\]]+)\]/);
    if (indexMatch) {
      indexMatch[1].split(',').map(f => f.trim().split('(')[0]).forEach(f => declaredIndexes.add(`${currentModel}.${f}`));
      continue;
    }

    // Track @unique (implies index)
    if (line.match(/@unique/)) {
      const fieldMatch = line.match(/^\s+(\w+)\s+/);
      if (fieldMatch) declaredIndexes.add(`${currentModel}.${fieldMatch[1]}`);
    }
  }

  // Second pass: look for relation fields without @@index
  currentModel = '';
  inModel = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) { currentModel = modelMatch[1]; inModel = true; continue; }
    if (line.match(/^\}/) && inModel) { inModel = false; continue; }
    if (!inModel) continue;

    // FK fields (Int or String with @relation or matching *Id pattern)
    const fkMatch = line.match(/^\s+(\w+Id)\s+(Int|String)\s/);
    if (fkMatch) {
      const field = fkMatch[1];
      const key = `${currentModel}.${field}`;
      if (!declaredIndexes.has(key)) {
        findings.push({
          repo: repo.repo, domain: repo.domain, orm: repo.orm,
          file: schemaPath, line: i + 1,
          patternType: 'missing-fk-index',
          model: currentModel, field,
          description: `FK field '${field}' on model '${currentModel}' has no @@index — Prisma does not auto-index FK columns`,
        });
      }
    }

    // createdAt / updatedAt used in orderBy commonly — flag if no index
    const timestampMatch = line.match(/^\s+(createdAt|updatedAt)\s+DateTime/);
    if (timestampMatch) {
      const field = timestampMatch[1];
      const key = `${currentModel}.${field}`;
      if (!declaredIndexes.has(key)) {
        findings.push({
          repo: repo.repo, domain: repo.domain, orm: repo.orm,
          file: schemaPath, line: i + 1,
          patternType: 'missing-sort-index',
          model: currentModel, field,
          description: `'${field}' on '${currentModel}' commonly used in orderBy but has no @@index`,
        });
      }
    }
  }

  return findings;
}

function findPrismaSchemas(repoDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (entry.name === 'schema.prisma') results.push(full);
    }
  }
  walk(repoDir);
  return results;
}

async function main() {
  if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const corpus = loadCorpus();
  const prismaRepos = corpus.filter(r => r.orm === 'Prisma');
  console.log(`Scanning ${prismaRepos.length} Prisma repos from corpus...\n`);

  const allFindings: IndexFinding[] = [];

  for (const repo of prismaRepos) {
    console.log(`[${repo.index}] ${repo.repo}`);
    try {
      const repoDir = cloneRepo(repo);
      const schemas = findPrismaSchemas(repoDir);
      console.log(`  Found ${schemas.length} schema.prisma file(s)`);

      for (const schema of schemas) {
        const findings = scanPrismaSchema(schema, repo);
        console.log(`  ${path.relative(repoDir, schema)}: ${findings.length} findings`);
        allFindings.push(...findings);
      }
    } catch (err) {
      console.warn(`  Error: ${(err as Error).message}`);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const findingsFile = path.join(RESULTS_DIR, `findings-${timestamp}.json`);
  fs.writeFileSync(findingsFile, JSON.stringify(allFindings, null, 2));

  // Prevalence summary
  const byPattern = new Map<string, number>();
  const byRepo = new Map<string, number>();
  for (const f of allFindings) {
    byPattern.set(f.patternType, (byPattern.get(f.patternType) ?? 0) + 1);
    byRepo.set(f.repo, (byRepo.get(f.repo) ?? 0) + 1);
  }

  const prevalence = {
    totalRepos: prismaRepos.length,
    totalFindings: allFindings.length,
    byPattern: Object.fromEntries(byPattern),
    byRepo: Object.fromEntries([...byRepo.entries()].sort((a, b) => b[1] - a[1])),
  };

  const prevFile = path.join(RESULTS_DIR, `prevalence-${timestamp}.json`);
  fs.writeFileSync(prevFile, JSON.stringify(prevalence, null, 2));

  console.log(`\nFindings:   ${findingsFile}`);
  console.log(`Prevalence: ${prevFile}`);
  console.log(`\nTotal findings: ${allFindings.length} across ${prismaRepos.length} repos`);
}

main().catch(err => { console.error(err); process.exit(1); });
