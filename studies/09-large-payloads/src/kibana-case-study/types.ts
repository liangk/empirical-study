import type { Finding as DetectorFinding } from '../step3-static-analysis/detector/payload-detector';

export interface KibanaFinding extends DetectorFinding {
  repoRelativePath: string;
  packageName: string | null;
  packagePath: string | null;
  layer: 'route' | 'service' | 'repository' | 'test' | 'other';
  isTestFile: boolean;
}

export interface GitFindingMetadata {
  commitHash: string;
  author: string;
  authorTime: number;
  authorDate: string;
  summary: string;
  quarter: string;
}

export interface KibanaFindingWithGit extends KibanaFinding {
  git?: GitFindingMetadata | null;
}
