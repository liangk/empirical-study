import { scanDirectory } from './scanner';
import { analyzeStudyResults } from './analyze';
import { buildReport } from './build-report';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'scan': {
      const pathArg = getArgValue('--path') || '.';
      const output = getArgValue('--output') || 'results/cache-opportunities.json';
      await scanDirectory(pathArg, output);
      break;
    }
    case 'analyze': {
      const input = getArgValue('--input') || 'results/cache-opportunities.json';
      const output = getArgValue('--output') || 'results/summary.json';
      await analyzeStudyResults(input, output);
      break;
    }
    case 'report': {
      const analysis = getArgValue('--analysis') || 'results/summary.json';
      const output = getArgValue('--output') || 'results/cache-opportunities-report.md';
      await buildReport(analysis, output);
      break;
    }
    default:
      console.log('Usage: node -r ts-node/register src/index.ts <scan|analyze|report> [--path <dir>] [--input <file>] [--output <file>]');
  }
}

function getArgValue(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return undefined;
  return args[index + 1];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
