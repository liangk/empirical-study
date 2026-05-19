#!/usr/bin/env node

const { detectInFile, printFindings } = require('./src/step3-static-analysis/detector/redos-detector.ts');

async function main() {
  const testFile = process.argv[2] || 'test-regex.js';

  console.log(`Testing detector on: ${testFile}`);

  try {
    const findings = detectInFile(testFile);
    printFindings(findings);

    if (findings.length === 0) {
      console.log('No vulnerabilities found. This might indicate:');
      console.log('1. The patterns are not vulnerable');
      console.log('2. The detector logic has bugs');
      console.log('3. The regex parsing is failing');
    }

    // Debug: show what patterns were tested
    const fs = require('fs');
    const content = fs.readFileSync(testFile, 'utf-8');
    const regexLiterals = content.match(/\/[^\/]*\//g) || [];
    console.log(`\nFound ${regexLiterals.length} regex literals in file:`);
    regexLiterals.forEach((regex, i) => console.log(`${i+1}. ${regex}`));

  } catch (error) {
    console.error('Error:', error);
  }
}

if (require.main === module) {
  main();
}