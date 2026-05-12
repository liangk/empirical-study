// Corpus parser for Study 09: Large Payload Anti-Patterns

import * as fs from 'fs';
import * as path from 'path';

export interface CorpusRepo {
  index: number;
  name: string;
  type: 'REST' | 'GraphQL' | 'REST/GraphQL';
  url: string;
  stars: string;
  notes: string;
  domain: string;
}

export function parseCorpus(corpusPath: string): CorpusRepo[] {
  const content = fs.readFileSync(corpusPath, 'utf-8');
  const lines = content.split('\n');
  const repos: CorpusRepo[] = [];

  let currentDomain = '';
  let index = 0;

  for (const line of lines) {
    // Domain headers: ## Domain N: Name (count)
    const domainMatch = line.match(/^## Domain \d+: (.+?) \(\d+ repos\)/);
    if (domainMatch) {
      currentDomain = domainMatch[1];
      continue;
    }

    // Table rows: | # | Repo | Type | URL | Stars | Notes |
    const rowMatch = line.match(/^\| (\d+) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \| (.+?) \|$/);
    if (rowMatch) {
      const [, num, name, type, url, stars, notes] = rowMatch;
      repos.push({
        index: parseInt(num, 10),
        name: name.trim(),
        type: type.trim() as any,
        url: url.trim(),
        stars: stars.trim(),
        notes: notes.trim(),
        domain: currentDomain,
      });
      index++;
    }
  }

  return repos;
}

export function getCorpusPath(): string {
  return path.join(__dirname, '..', '..', 'data', 'corpus.md');
}
