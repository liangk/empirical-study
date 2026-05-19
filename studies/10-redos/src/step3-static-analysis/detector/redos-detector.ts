// ReDoS Vulnerability Detector for Study 10
// Babel AST detector for vulnerable regex patterns

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import ret from 'ret';

export interface Finding {
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  line: number;
  code: string;
  description: string;
  complexityScore: number;
  vulnerable: boolean;
}

const PATTERNS = {
  nested_quantifiers: {
    severity: 'critical' as const,
    description: 'Nested quantifiers causing exponential backtracking (e.g., (a*)*)',
  },
  overlapping_alternatives: {
    severity: 'high' as const,
    description: 'Overlapping alternatives in groups (e.g., (a|a)*, (token|token)+)',
  },
  large_repetition: {
    severity: 'medium' as const,
    description: 'Large unbounded repetition (e.g., a{100,})',
  },
  complex_groups: {
    severity: 'high' as const,
    description: 'Complex nested groups with quantifiers',
  },
  missing_possessive: {
    severity: 'medium' as const,
    description: 'Greedy quantifiers that could be possessive',
  },
  email_pattern: {
    severity: 'medium' as const,
    description: 'Email validation pattern that may be vulnerable to ReDoS',
  },
  url_pattern: {
    severity: 'medium' as const,
    description: 'URL validation pattern that may be vulnerable to ReDoS',
  },
  unbounded_quantifiers: {
    severity: 'low' as const,
    description: 'Multiple unbounded quantifiers that could cause performance issues',
  },
};

export function detectInFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      allowImportExportEverywhere: true,
    });

    traverse(ast, {
      RegExpLiteral(path) {
        const regex = path.node;
        const line = regex.loc?.start.line || 0;
        const code = content.split('\n')[line - 1]?.trim() || '';

        const analysis = analyzeRegex(regex.pattern, regex.flags);
        if (analysis.vulnerable) {
          findings.push({
            pattern: analysis.pattern,
            severity: analysis.severity,
            file: filePath,
            line,
            code,
            description: analysis.description,
            complexityScore: analysis.complexityScore,
            vulnerable: true,
          });
        }
      },

      // Also check new RegExp() calls
      NewExpression(path) {
        if (t.isIdentifier(path.node.callee, { name: 'RegExp' })) {
          const args = path.node.arguments;
          if (args.length > 0 && t.isStringLiteral(args[0])) {
            const pattern = args[0].value;
            const flags = args[1] && t.isStringLiteral(args[1]) ? args[1].value : '';
            const line = path.node.loc?.start.line || 0;
            const code = content.split('\n')[line - 1]?.trim() || '';

            const analysis = analyzeRegex(pattern, flags);
            if (analysis.vulnerable) {
              findings.push({
                pattern: analysis.pattern,
                severity: analysis.severity,
                file: filePath,
                line,
                code,
                description: analysis.description,
                complexityScore: analysis.complexityScore,
                vulnerable: true,
              });
            }
          }
        }
      },
    });
  } catch (error) {
    // Skip files that can't be parsed
  }

  return findings;
}

function analyzeRegex(pattern: string, flags: string): {
  pattern: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  complexityScore: number;
  vulnerable: boolean;
} {
  let complexityScore = 0;
  let vulnerable = false;
  let detectedPattern = '';
  let severity: 'critical' | 'high' | 'medium' | 'low' = 'low';
  let description = '';

  try {
    const parsed = ret(pattern);

    // Calculate complexity score
    complexityScore = calculateComplexity(parsed);

    // Debug output
    // console.log(`Analyzing pattern: ${pattern}`);
    // console.log(`  Complexity: ${complexityScore}`);

    // Check for vulnerable patterns
    if (hasNestedQuantifiers(parsed)) {
      vulnerable = true;
      detectedPattern = 'nested_quantifiers';
      severity = 'critical';
      description = PATTERNS.nested_quantifiers.description;
    } else if (hasOverlappingAlternatives(parsed)) {
      vulnerable = true;
      detectedPattern = 'overlapping_alternatives';
      severity = 'high';
      description = PATTERNS.overlapping_alternatives.description;
    } else if (hasEmailPattern(pattern)) {
      vulnerable = true;
      detectedPattern = 'email_pattern';
      severity = 'medium';
      description = PATTERNS.email_pattern.description;
    } else if (hasUrlPattern(pattern)) {
      vulnerable = true;
      detectedPattern = 'url_pattern';
      severity = 'medium';
      description = PATTERNS.url_pattern.description;
    } else if (hasLargeRepetition(parsed)) {
      vulnerable = true;
      detectedPattern = 'large_repetition';
      severity = 'medium';
      description = PATTERNS.large_repetition.description;
    } else if (hasComplexGroups(parsed)) {
      vulnerable = true;
      detectedPattern = 'complex_groups';
      severity = 'high';
      description = PATTERNS.complex_groups.description;
    } else if (hasUnboundedQuantifiers(parsed)) {
      vulnerable = true;
      detectedPattern = 'unbounded_quantifiers';
      severity = 'low';
      description = PATTERNS.unbounded_quantifiers.description;
    } else if (complexityScore > 100) {
      // High complexity even if not specific pattern
      vulnerable = true;
      detectedPattern = 'high_complexity';
      severity = 'medium';
      description = 'High complexity regex that may cause performance issues';
    }

  } catch (error) {
    console.log(`  Error parsing regex: ${error}`);
    // If regex can't be parsed, assume safe
  }

  return {
    pattern: detectedPattern,
    severity,
    description,
    complexityScore,
    vulnerable,
  };
}

function calculateComplexity(node: any): number {
  let score = 0;

  function traverse(n: any): void {
    if (!n) return;

    if (n.type === 'quantifier') {
      score += n.min + (n.max || n.min);
      if (n.min > 1 || n.max > 1) score *= 1.5;
    }

    if (n.type === 'group') {
      score += 2;
    }

    if (n.options) {
      n.options.forEach(traverse);
    }

    if (n.value) {
      traverse(n.value);
    }

    if (Array.isArray(n)) {
      n.forEach(traverse);
    }
  }

  traverse(node);
  return score;
}

function hasNestedQuantifiers(node: any): boolean {
  function traverse(n: any): boolean {
    if (!n) return false;

    if (n.type === 'quantifier' && n.value && n.value.type === 'quantifier') {
      return true;
    }

    if (n.value) return traverse(n.value);
    if (n.options) return n.options.some(traverse);
    if (Array.isArray(n)) return n.some(traverse);

    return false;
  }

  return traverse(node);
}

function hasOverlappingAlternatives(node: any): boolean {
  function traverse(n: any): boolean {
    if (!n) return false;

    // Check for groups with alternatives (type 1 = group)
    if (n.type === 1 && n.options && n.options.length > 1) {
      // Look for identical alternatives
      for (let i = 0; i < n.options.length; i++) {
        for (let j = i + 1; j < n.options.length; j++) {
          if (JSON.stringify(n.options[i]) === JSON.stringify(n.options[j])) {
            return true; // Found identical alternatives like (a|a)
          }
        }
      }

      // For now, any group with multiple alternatives is potentially vulnerable
      // This is a simplified approach - real ReDoS detection is more complex
      return true;
    }

    // Recursively check nested structures
    if (n.value) return traverse(n.value);
    if (n.stack) return n.stack.some(traverse);
    if (n.options) return n.options.some((opt: any) => Array.isArray(opt) ? opt.some(traverse) : traverse(opt));

    return false;
  }

  return traverse(node);
}

function stringifyOption(node: any): string {
  if (!node) return '';

  if (node.type === 'char') return node.value;
  if (node.type === 'set') return `[${node.value}]`;
  if (node.type === 'range') return `${node.from}-${node.to}`;

  // Handle quantifiers
  if (node.type === 'quantifier') {
    const base = stringifyOption(node.value);
    if (node.min === 0 && node.max === 1) return base + '?';
    if (node.min === 0 && node.max === Infinity) return base + '*';
    if (node.min === 1 && node.max === Infinity) return base + '+';
    if (node.min === node.max) return base + `{${node.min}}`;
    if (node.max === Infinity) return base + `{${node.min},}`;
    return base + `{${node.min},${node.max}}`;
  }

  // Handle groups
  if (node.type === 'group') {
    if (node.options && node.options.length > 0) {
      const alts = node.options.map(stringifyOption).join('|');
      return `(${alts})`;
    }
    return `(${stringifyOption(node.value)})`;
  }

  // Handle sequences
  if (Array.isArray(node)) {
    return node.map(stringifyOption).join('');
  }

  // Handle other types
  if (node.value) return stringifyOption(node.value);
  if (node.options) return node.options.map(stringifyOption).join('|');

  return '';
}

function hasLargeRepetition(node: any): boolean {
  function traverse(n: any): boolean {
    if (!n) return false;

    if (n.type === 'quantifier' && n.min >= 100) {
      return true;
    }

    if (n.value) return traverse(n.value);
    if (n.options) return n.options.some(traverse);
    if (Array.isArray(n)) return n.some(traverse);

    return false;
  }

  return traverse(node);
}

function hasComplexGroups(node: any): boolean {
  function traverse(n: any, depth = 0): boolean {
    if (!n) return false;

    if (n.type === 'group' && depth > 2) {
      return true;
    }

    if (n.type === 'group') {
      return traverse(n.value, depth + 1);
    }

    if (n.value) return traverse(n.value, depth);
    if (n.options) return n.options.some((opt: any) => traverse(opt, depth));
    if (Array.isArray(n)) return n.some((item: any) => traverse(item, depth));

    return false;
  }

  return traverse(node);
}

function hasEmailPattern(pattern: string): boolean {
  // Common email validation patterns that can be vulnerable
  // Look for patterns like: [^@]+@[^@]+\.[^@]+
  const emailIndicators = [
    /@\[\^@\]\+/,  // @[^@]+
    /\.\[\^@\]\+/, // .[^@]+
    /\[\^@\]\+@\[\^@\]\+\.\[\^@\]\+/, // [^@]+@[^@]+\.[^@]+
  ];

  return emailIndicators.some(indicator => indicator.test(pattern));
}

function hasUrlPattern(pattern: string): boolean {
  // Common URL validation patterns that can be vulnerable
  const urlIndicators = [
    /https?:\/\//,  // http:// or https://
    /[\^\/]\+\//,    // [^/]+/
    /[\^:]\+:\d+/,   // [^:]+:\d+
  ];

  return urlIndicators.some(indicator => indicator.test(pattern));
}

function hasUnboundedQuantifiers(node: any): boolean {
  let unboundedCount = 0;

  function traverse(n: any): void {
    if (!n) return;

    if (n.type === 'quantifier' && n.max === Infinity) {
      unboundedCount++;
    }

    if (n.value) traverse(n.value);
    if (n.options) n.options.forEach(traverse);
    if (Array.isArray(n)) n.forEach(traverse);
  }

  traverse(node);
  return unboundedCount >= 3; // Multiple unbounded quantifiers can be problematic
}

export async function detectInDirectory(dirPath: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = await glob('**/*.{js,ts,jsx,tsx}', {
    cwd: dirPath,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', '.git/**'],
  });

  for (const file of files) {
    const fileFindings = detectInFile(file);
    findings.push(...fileFindings);
  }

  return findings;
}

export function printFindings(findings: Finding[]): void {
  console.log(`Found ${findings.length} potential ReDoS vulnerabilities:`);

  for (const finding of findings) {
    console.log(`\n${finding.severity.toUpperCase()}: ${finding.description}`);
    console.log(`  File: ${finding.file}:${finding.line}`);
    console.log(`  Code: ${finding.code}`);
    console.log(`  Complexity: ${finding.complexityScore}`);
  }
}