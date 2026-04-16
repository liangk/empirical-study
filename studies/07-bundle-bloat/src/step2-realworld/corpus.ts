import * as fs from 'fs';
import * as path from 'path';

export interface CorpusRepo {
  url: string;
  owner: string;
  name: string;
  domain: string;
  framework: 'react' | 'vue' | 'angular' | 'mixed' | 'unknown';
}

export function loadCorpus(corpusPath: string): CorpusRepo[] {
  const content = fs.readFileSync(corpusPath, 'utf8');
  const repos: CorpusRepo[] = [];
  let currentDomain = '';

  for (const line of content.split('\n')) {
    const domainMatch = line.match(/^##\s+Domain\s+\d+[:：]\s+(.+)/);
    if (domainMatch) { currentDomain = domainMatch[1].trim(); continue; }

    const repoMatch = line.match(/^\|\s*\d+\s*\|\s*(https?:\/\/github\.com\/([^/]+)\/([^/\s|]+))/);
    if (!repoMatch) continue;

    const url = repoMatch[1].trim();
    const owner = repoMatch[2].trim();
    const name = repoMatch[3].trim();

    const framework = currentDomain.toLowerCase().includes('vue') || currentDomain.toLowerCase().includes('angular')
      ? (currentDomain.toLowerCase().includes('angular') ? 'angular' : 'vue')
      : 'react';

    repos.push({ url, owner, name, domain: currentDomain, framework });
  }

  return repos;
}
