import * as fs from 'fs';
import * as path from 'path';
import type { Finding as DetectorFinding } from '../step3-static-analysis/detector/payload-detector';
import type { KibanaFinding } from './types';

const PACKAGE_MATCHERS = [
  /(?:x-pack\/plugins|src\/plugins|packages)\/([^\/]+)/,
];

export function enrichKibanaFinding(finding: DetectorFinding, repoRoot: string): KibanaFinding {
  const absoluteFile = path.resolve(finding.file);
  const root = path.resolve(repoRoot);
  const repoRelativePath = normalizeRepoRelative(absoluteFile, root);
  const packageInfo = findPackageInfo(absoluteFile, root, repoRelativePath);
  const content = fs.existsSync(absoluteFile) ? fs.readFileSync(absoluteFile, 'utf8') : '';

  return {
    ...finding,
    repoRelativePath,
    packageName: packageInfo.packageName,
    packagePath: packageInfo.packagePath,
    layer: classifyLayer(repoRelativePath, content),
    isTestFile: isTestFile(absoluteFile, repoRelativePath),
  };
}

function normalizeRepoRelative(filePath: string, repoRoot: string): string {
  const relative = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  return relative.startsWith('.') ? filePath : relative;
}

function findPackageInfo(filePath: string, repoRoot: string, repoRelativePath: string) {
  const packagePath = findNearestPackageJsonDir(filePath, repoRoot);
  if (packagePath) {
    const name = readPackageName(packagePath);
    return {
      packageName: name ?? normalizePackageFromPath(repoRelativePath),
      packagePath,
    };
  }

  return {
    packageName: normalizePackageFromPath(repoRelativePath),
    packagePath: null,
  };
}

function findNearestPackageJsonDir(filePath: string, repoRoot: string): string | null {
  let current = path.dirname(filePath);
  const root = path.resolve(repoRoot);

  while (true) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    if (path.resolve(current) === root) {
      break;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function readPackageName(packageJsonPath: string): string | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string };
    return pkg.name ?? null;
  } catch {
    return null;
  }
}

function normalizePackageFromPath(repoRelativePath: string): string | null {
  for (const matcher of PACKAGE_MATCHERS) {
    const match = repoRelativePath.match(matcher);
    if (match && match[1]) {
      return match[1];
    }
  }

  const segments = repoRelativePath.split('/');
  return segments.length > 1 ? segments[0] : null;
}

function classifyLayer(repoRelativePath: string, content: string): KibanaFinding['layer'] {
  const normalized = repoRelativePath.toLowerCase();
  const isTest = isTestFile('', repoRelativePath);
  if (isTest) {
    return 'test';
  }

  if (/\b(routes?|router|api\/|server\/routes?|server\/router|endpoint)\b/.test(normalized)
      || /(app\.(get|post|put|delete|use)|router\.(get|post|put|delete)|new\s+Router\(|express\.Router|router\s*=\s*Router\()/i.test(content)) {
    return 'route';
  }

  if (/\b(service|services|use-service|controller)\b/.test(normalized)
      || /\bService\b/.test(path.basename(repoRelativePath))) {
    return 'service';
  }

  if (/\b(repo|repository|repositories|persistence|storage)\b/.test(normalized)) {
    return 'repository';
  }

  return 'other';
}

function isTestFile(absolutePath: string, repoRelativePath: string): boolean {
  const lower = repoRelativePath.toLowerCase();
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(lower)) {
    return true;
  }

  return /\b(__tests__|tests?|specs?)\b/.test(lower);
}
