import * as fs from 'fs';
import * as path from 'path';

export interface CorpusRepo {
  index: number;
  repo: string;         // owner/name
  orm: string;          // Prisma | Sequelize | TypeORM | etc.
  url: string;
  stars: string;
  patterns: string[];   // expected missing index pattern types
  domain: string;       // section heading in corpus.md
}

const CORPUS_PATH = path.join(__dirname, '..', '..', 'data', 'corpus.md');

export function loadCorpus(): CorpusRepo[] {
  const content = fs.readFileSync(CORPUS_PATH, 'utf8');
  const lines = content.split('\n');
  const repos: CorpusRepo[] = [];
  let currentDomain = '';
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith('## Domain')) {
      currentDomain = line.replace(/^##\s+/, '').trim();
      inTable = false;
      continue;
    }
    if (line.match(/^\|\s*#\s*\|/)) { inTable = true; continue; }
    if (line.match(/^\|[-\s|]+\|/)) continue;
    if (!inTable || !line.startsWith('|')) continue;

    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 5) continue;

    const [idxStr, repoRaw, urlRaw, stars, patternsRaw] = cols;
    const index = parseInt(idxStr, 10);
    if (isNaN(index)) continue;

    const repo = repoRaw.trim();
    const urlMatch = urlRaw.match(/https?:\/\/[^\s)]+/);
    const url = urlMatch ? urlMatch[0] : urlRaw;

    const patterns = patternsRaw.split(',').map(p => p.trim()).filter(Boolean);

    repos.push({ index, repo, orm: 'Prisma', url, stars, patterns, domain: currentDomain });
  }

  return repos;
}
