// Validate and clean corpus - removes dead/not-found repos
import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

interface RepoStatus {
  url: string;
  status: 'valid' | 'not-found' | 'error';
  error?: string;
}

async function validateRepo(repoUrl: string): Promise<RepoStatus> {
  const git = simpleGit();
  
  try {
    // Try to get repo info without cloning - just test if it exists
    const result = await git.listRemote(['--heads', repoUrl]);
    
    if (result) {
      return { url: repoUrl, status: 'valid' };
    }
  } catch (error: any) {
    const errorMsg = error.toString();
    
    // Check if it's a "not found" error
    if (errorMsg.includes('not found') || errorMsg.includes('repository')) {
      return { url: repoUrl, status: 'not-found', error: 'Repository not found' };
    }
    
    return { url: repoUrl, status: 'error', error: errorMsg.substring(0, 100) };
  }
  
  return { url: repoUrl, status: 'error', error: 'Unknown error' };
}

async function main() {
  const corpusFile = path.join(__dirname, '..', 'data', 'corpus.md');
  const content = fs.readFileSync(corpusFile, 'utf-8');
  
  // Extract URLs
  const repoUrls = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('https://') && line.includes('github.com'));
  
  console.log(`Found ${repoUrls.length} repos in corpus`);
  console.log('Validating repos...\n');
  
  const validRepos: string[] = [];
  const notFoundRepos: string[] = [];
  const errorRepos: RepoStatus[] = [];
  
  let processed = 0;
  
  for (const url of repoUrls) {
    processed++;
    process.stdout.write(`\r[${processed}/${repoUrls.length}] Checking repos...`);
    
    const status = await validateRepo(url);
    
    if (status.status === 'valid') {
      validRepos.push(url);
    } else if (status.status === 'not-found') {
      notFoundRepos.push(url);
    } else {
      errorRepos.push(status);
    }
  }
  
  console.log('\n\n=== VALIDATION RESULTS ===');
  console.log(`✓ Valid repos: ${validRepos.length}`);
  console.log(`✗ Not found: ${notFoundRepos.length}`);
  console.log(`⚠ Errors: ${errorRepos.length}`);
  
  if (notFoundRepos.length > 0) {
    console.log('\n📋 Not Found Repos:');
    notFoundRepos.forEach(url => console.log(`  - ${url}`));
  }
  
  if (errorRepos.length > 0) {
    console.log('\n⚠️ Error Repos:');
    errorRepos.forEach(repo => console.log(`  - ${repo.url}: ${repo.error}`));
  }
  
  // Save cleaned corpus
  const cleanedCorpusContent = `# ReDoS Study Corpus (Cleaned)

This file contains the validated corpus with dead repos removed.

## Summary
- Total repos: ${validRepos.length}
- Removed (not found): ${notFoundRepos.length}
- Removed (errors): ${errorRepos.length}

## Valid Repositories

${validRepos.join('\n')}
`;
  
  const cleanedCorpusFile = path.join(__dirname, '..', 'data', 'corpus-cleaned.md');
  fs.writeFileSync(cleanedCorpusFile, cleanedCorpusContent);
  
  console.log(`\n✅ Cleaned corpus saved to: ${cleanedCorpusFile}`);
  console.log(`   Use this file for future scans: --corpus data/corpus-cleaned.md`);
  
  // Save detailed report
  const reportFile = path.join(__dirname, '..', 'results', 'corpus-validation-report.json');
  fs.writeFileSync(reportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalRepos: repoUrls.length,
    validRepos: validRepos.length,
    notFoundRepos: notFoundRepos.length,
    errorRepos: errorRepos.length,
    notFound: notFoundRepos,
    errors: errorRepos
  }, null, 2));
  
  console.log(`📊 Detailed report saved to: ${reportFile}`);
}

main().catch(console.error);
