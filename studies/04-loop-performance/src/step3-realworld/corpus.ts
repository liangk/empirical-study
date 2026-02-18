import { readFileSync } from 'fs';
import { join } from 'path';

export interface CorpusRepo {
  index: number;
  name: string;
  url: string;
  stars: string;
  domain: string;
  language: 'JS' | 'Python';
  expectedPatterns: string[];
}

const CORPUS_PATH = join(__dirname, '..', '..', 'data', 'corpus.md');

/**
 * Parse data/corpus.md and return a structured list of corpus repos.
 *
 * New 6-column format (per updated plan §4.1):
 *   | # | Repository | Lang | URL | Stars | Expected Anti-Patterns |
 *
 * Domain is extracted from the nearest preceding `## Domain N — <Name>` heading.
 * Legacy 5-column format (# | repo | url | stars | domain) also supported as fallback.
 */
export function loadCorpus(): CorpusRepo[] {
  const text = readFileSync(CORPUS_PATH, 'utf-8');
  const repos: CorpusRepo[] = [];

  const sixColRe = /^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*(JS|Py)\s*\|\s*(https?:\/\/[^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/;
  const fiveColRe = /^\|\s*(\d+)\s*\|\s*([^|]+)\|\s*(https?:\/\/[^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/;
  const domainHeadingRe = /^##\s+Domain\s+\d+\s+[—–-]\s+(.+)/i;

  let currentDomain = 'unknown';

  for (const line of text.split('\n')) {
    const dMatch = line.match(domainHeadingRe);
    if (dMatch) { currentDomain = dMatch[1].trim(); continue; }

    const six = line.match(sixColRe);
    if (six) {
      const index = parseInt(six[1], 10);
      const name = six[2].trim();
      const langTag = six[3].trim();
      const url = six[4].trim();
      const stars = six[5].trim();
      const patterns = six[6].trim();
      const language: 'JS' | 'Python' = langTag === 'JS' ? 'JS' : 'Python';
      repos.push({ index, name, url, stars, domain: currentDomain, language, expectedPatterns: patterns.split(',').map(s => s.trim()) });
      continue;
    }

    const five = line.match(fiveColRe);
    if (five) {
      const index = parseInt(five[1], 10);
      const name = five[2].trim();
      const url = five[3].trim();
      const stars = five[4].trim();
      const domain = five[5].trim();
      const language: 'JS' | 'Python' = index <= 20 ? 'JS' : 'Python';
      repos.push({ index, name, url, stars, domain, language, expectedPatterns: [] });
    }
  }

  return repos;
}

/** Filter corpus to a specific language. */
export function filterByLanguage(repos: CorpusRepo[], lang: 'JS' | 'Python'): CorpusRepo[] {
  return repos.filter(r => r.language === lang);
}
