import * as fs from 'fs';
import * as path from 'path';

export interface CorpusRepo {
  url: string;
  owner: string;
  name: string;
  domain: string;
  framework: 'react' | 'vue' | 'vanilla' | 'angular' | 'mixed';
}

export function loadCorpus(corpusPath: string): CorpusRepo[] {
  const content = fs.readFileSync(corpusPath, 'utf8');
  const repos: CorpusRepo[] = [];
  let currentDomain = '';

  for (const line of content.split('\n')) {
    const domainMatch = line.match(/^##\s+Domain\s+\d+[:：]\s+(.+)/);
    if (domainMatch) { currentDomain = domainMatch[1].trim(); continue; }

    const repoMatch = line.match(/^\|\s*\d+\s*\|\s*(https?:\/\/github\.com\/([^/]+)\/([^/\s|]+))\s*\|.*\|\s*(\w+)\s*\|/);
    if (!repoMatch) continue;

    const url = repoMatch[1].trim();
    const owner = repoMatch[2].trim();
    const name = repoMatch[3].trim();
    const frameworkRaw = repoMatch[4].trim().toLowerCase();

    const framework: CorpusRepo['framework'] =
      frameworkRaw === 'react' ? 'react'
      : frameworkRaw === 'vue' ? 'vue'
      : frameworkRaw === 'angular' ? 'angular'
      : frameworkRaw === 'vanilla' ? 'vanilla'
      : 'mixed';

    repos.push({ url, owner, name, domain: currentDomain, framework });
  }

  return repos;
}
