// Fast corpus cleaner - uses scan results to identify dead repos
// Much faster than validating all repos again

import * as fs from 'fs';
import * as path from 'path';

interface ScanResult {
  repo: string;
  url: string;
  findings: any[];
  totalFiles: number;
  scannedFiles: number;
}

async function main() {
  const corpusFile = path.join(__dirname, '..', 'data', 'corpus.md');
  const resultsFile = path.join(__dirname, '..', 'results', 'scan-results.json');

  if (!fs.existsSync(resultsFile)) {
    console.error('Scan results not found. Run "npm run scan" first.');
    process.exit(1);
  }

  console.log('Loading corpus and scan results...\n');

  const corpusContent = fs.readFileSync(corpusFile, 'utf-8');
  const scanResults: ScanResult[] = JSON.parse(
    fs.readFileSync(resultsFile, 'utf8')
  );

  // Extract all URLs from corpus
  const corpusUrls = new Set(
    corpusContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('https://') && line.includes('github.com'))
  );

  // Extract URLs that were successfully scanned
  const scannedUrls = new Map<string, ScanResult>();
  scanResults.forEach((result) => {
    scannedUrls.set(result.url, result);
  });

  // Find dead repos (not in scan results)
  const deadRepos = Array.from(corpusUrls).filter(
    (url) => !scannedUrls.has(url)
  );

  // Find repos with scans
  const aliveRepos = Array.from(scannedUrls.values()).filter(
    (result) => corpusUrls.has(result.url)
  );

  console.log('=== CORPUS ANALYSIS ===\n');
  console.log(`Total repos in corpus: ${corpusUrls.size}`);
  console.log(`Successfully scanned: ${aliveRepos.length}`);
  console.log(`Dead/not-found repos: ${deadRepos.length}`);
  console.log(`Removal rate: ${((deadRepos.length / corpusUrls.size) * 100).toFixed(2)}%\n`);

  if (deadRepos.length > 0) {
    console.log('🔴 DEAD REPOS (TO BE REMOVED):\n');
    deadRepos.forEach((url, idx) => {
      console.log(`${idx + 1}. ${url}`);
    });
  }

  // Generate cleaned corpus
  const cleanedContent = `# ReDoS Study Corpus (Cleaned)

This file contains the corpus with dead/not-found repositories removed.

## Statistics
- Original repos: ${corpusUrls.size}
- Repos removed: ${deadRepos.length}
- Valid repos retained: ${aliveRepos.length}
- Removal rate: ${((deadRepos.length / corpusUrls.size) * 100).toFixed(2)}%

## Valid Repositories

${aliveRepos.map((r) => r.url).join('\n')}
`;

  // Save cleaned corpus
  const cleanedCorpusFile = path.join(__dirname, '..', 'data', 'corpus-cleaned.md');
  fs.writeFileSync(cleanedCorpusFile, cleanedContent);

  console.log(`\n✅ Cleaned corpus saved: ${cleanedCorpusFile}`);

  // Generate removal report
  const reportFile = path.join(
    __dirname,
    '..',
    'results',
    'corpus-cleanup-report.json'
  );
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalRepos: corpusUrls.size,
        validRepos: aliveRepos.length,
        deadRepos: deadRepos.length,
        removalRate: `${((deadRepos.length / corpusUrls.size) * 100).toFixed(2)}%`,
        removedRepositories: deadRepos,
        retainedRepositories: aliveRepos.map((r) => ({
          repo: r.repo,
          url: r.url,
          filesScanned: r.scannedFiles,
          findingsCount: r.findings.length,
        })),
      },
      null,
      2
    )
  );

  console.log(`📊 Cleanup report saved: ${reportFile}\n`);

  // Show impact statistics
  const removedFindings = aliveRepos
    .filter(
      (r) => !deadRepos.some((dr) => r.url.includes(dr.split('/').pop() || ''))
    )
    .reduce((sum, r) => sum + r.findings.length, 0);

  console.log('=== IMPACT ANALYSIS ===\n');
  console.log(`Findings in alive repos: ${aliveRepos.reduce((sum, r) => sum + r.findings.length, 0)}`);
  console.log(`Total files scanned: ${aliveRepos.reduce((sum, r) => sum + r.scannedFiles, 0)}`);
  console.log(`Avg findings per repo: ${(aliveRepos.reduce((sum, r) => sum + r.findings.length, 0) / aliveRepos.length).toFixed(2)}`);

  // Show most vulnerable repos
  const sortedRepos = aliveRepos.sort(
    (a, b) => b.findings.length - a.findings.length
  );

  console.log('\n🔴 Top 10 Most Vulnerable Repos:\n');
  sortedRepos.slice(0, 10).forEach((r, idx) => {
    console.log(
      `${idx + 1}. ${r.repo}: ${r.findings.length} findings (${r.scannedFiles} files)`
    );
  });

  console.log(`\n✨ Next step: Update your scanner to use corpus-cleaned.md`);
  console.log(`   Or run: npm run scan -- --corpus data/corpus-cleaned.md`);
}

main().catch(console.error);
