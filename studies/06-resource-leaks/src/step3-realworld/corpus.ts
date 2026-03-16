import * as fs from 'fs';
import * as path from 'path';

export interface CorpusRepo {
  index: number;
  repo: string;
  url: string;
  stars: string;
  domain: string;
  expectedPatterns: string;
}

/**
 * Parse data/corpus.md into a list of CorpusRepo entries.
 * Expects tables with columns: # | Repository | URL | Stars | Expected Patterns
 * Domain is extracted from section headings (## Domain N — Name).
 */
export function loadCorpus(): CorpusRepo[] {
  const corpusPath = path.join(__dirname, '..', '..', 'data', 'corpus.md');
  const content = fs.readFileSync(corpusPath, 'utf8');
  const lines = content.split('\n');

  const repos: CorpusRepo[] = [];
  let currentDomain = '';

  for (const line of lines) {
    // Detect domain heading
    const domainMatch = line.match(/^##\s+Domain\s+\d+\s+[—–-]\s+(.+)/);
    if (domainMatch) {
      currentDomain = domainMatch[1].trim();
      continue;
    }

    // Parse table rows: | # | Repository | URL | Stars | Expected Patterns |
    const tableMatch = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*(https:\/\/[^|]+)\|\s*([^|]+)\|\s*([^|]*)\|?/);
    if (tableMatch) {
      repos.push({
        index: parseInt(tableMatch[1].trim(), 10),
        repo: tableMatch[2].trim(),
        url: tableMatch[3].trim(),
        stars: tableMatch[4].trim(),
        domain: currentDomain,
        expectedPatterns: tableMatch[5]?.trim() ?? '',
      });
    }
  }

  return repos;
}
