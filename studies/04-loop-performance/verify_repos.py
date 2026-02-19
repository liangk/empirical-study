#!/usr/bin/env python3
"""
Repository Selection Verification Script
Verifies the three criteria from the article:
1. Active maintenance (commits in last 12 months)
2. Functioning test suite presence
3. Primary language matches expected

Also verifies stratification: exactly 8 repos per domain
"""

import os
import json
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# Configuration
STUDY_DIR = Path("c:/Users/liang/Projects/github/empirical-study/studies/04-loop-performance")
REPOS_DIR = STUDY_DIR / ".repos"
CORPUS_FILE = STUDY_DIR / "data" / "corpus.md"
REPORT_FILE = STUDY_DIR / "repo-verification-report.json"

# Test suite indicators by language
TEST_INDICATORS = {
    "JS": ["test/", "tests/", "__tests__/", "spec/", "specs/", "jest.config.js", "jest.config.ts", "vitest.config.ts", "vitest.config.js", ".mocharc.yml", ".mocharc.js"],
    "Py": ["test/", "tests/", "pytest.ini", "tox.ini", "setup.cfg", "conftest.py", "pyproject.toml"]
}

def parse_corpus():
    """Parse corpus.md to extract expected repositories"""
    repos = []
    current_domain = ""
    
    with open(CORPUS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for line in content.split('\n'):
        # Track domain headers
        if line.startswith('## Domain'):
            current_domain = line.split('—')[1].strip() if '—' in line else ""
            continue
        
        # Parse repo table rows
        if line.strip().startswith('|') and not line.strip().startswith('| #') and not line.strip().startswith('|---'):
            parts = [p.strip() for p in line.split('|')]
            parts = [p for p in parts if p]  # Remove empty parts
            
            if len(parts) >= 6 and parts[0].isdigit():
                idx = int(parts[0])
                repo_name = parts[1]
                lang = parts[2]
                url = parts[3]
                stars = parts[4]
                patterns = parts[5] if len(parts) > 5 else ""
                
                repos.append({
                    'index': idx,
                    'name': repo_name,
                    'url': url,
                    'stars': stars,
                    'domain': current_domain,
                    'expected_lang': lang,
                    'expected_patterns': patterns
                })
    
    return repos

def get_last_commit_date(repo_path):
    """Get the last commit date for a repository"""
    try:
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%cd'],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            date_str = result.stdout.strip()
            # Parse git date format
            try:
                # Try multiple formats
                for fmt in ['%a %b %d %H:%M:%S %Y %z', '%a %b %d %H:%M:%S %Y']:
                    try:
                        return datetime.strptime(date_str, fmt)
                    except ValueError:
                        continue
            except Exception:
                pass
            return date_str  # Return string if parsing fails
        return None
    except Exception as e:
        return f"Error: {str(e)}"

def check_active_maintenance(repo_path):
    """Check if repo has commits in last 12 months"""
    last_commit = get_last_commit_date(repo_path)
    
    if isinstance(last_commit, datetime):
        # Make both datetimes timezone-naive for comparison
        if last_commit.tzinfo is not None:
            last_commit = last_commit.replace(tzinfo=None)
        
        cutoff = datetime.now() - timedelta(days=365)
        is_active = last_commit > cutoff
        return {
            'is_active': is_active,
            'last_commit': last_commit.isoformat(),
            'days_since_cutoff': (cutoff - last_commit).days if not is_active else 0
        }
    elif last_commit:
        return {
            'is_active': 'unknown',
            'last_commit': str(last_commit),
            'error': 'Could not parse date'
        }
    else:
        return {
            'is_active': False,
            'error': 'Could not retrieve commit date'
        }

def check_test_suite(repo_path, expected_lang):
    """Check if repository has a test suite"""
    indicators = TEST_INDICATORS.get(expected_lang, [])
    found_indicators = []
    
    for indicator in indicators:
        test_path = repo_path / indicator
        if test_path.exists():
            found_indicators.append(indicator)
    
    # Check for package.json test scripts
    if expected_lang == "JS":
        pkg_file = repo_path / "package.json"
        if pkg_file.exists():
            try:
                with open(pkg_file) as f:
                    pkg = json.load(f)
                    if pkg.get('scripts', {}).get('test'):
                        found_indicators.append(f"package.json#test: {pkg['scripts']['test']}")
            except:
                pass
    
    return {
        'has_test_suite': len(found_indicators) > 0,
        'found_indicators': found_indicators
    }

def analyze_primary_language(repo_path):
    """Analyze the primary language of the repository by file count"""
    extensions = {
        'JS': ['.js', '.jsx'],
        'TS': ['.ts', '.tsx'],
        'Py': ['.py'],
        'Go': ['.go'],
        'Rust': ['.rs'],
        'Java': ['.java'],
        'C++': ['.cpp', '.cc', '.cxx'],
        'C': ['.c', '.h']
    }
    
    counts = {lang: 0 for lang in extensions}
    
    for root, dirs, files in os.walk(repo_path):
        # Skip .git and node_modules
        dirs[:] = [d for d in dirs if d not in ['.git', 'node_modules', '__pycache__', '.venv', 'venv']]
        
        for file in files:
            for lang, exts in extensions.items():
                if any(file.endswith(ext) for ext in exts):
                    counts[lang] += 1
    
    total = sum(counts.values())
    if total == 0:
        return {'primary_lang': 'unknown', 'total_files': 0}
    
    primary = max(counts, key=counts.get)
    primary_count = counts[primary]
    percentage = (primary_count / total) * 100
    
    return {
        'primary_lang': primary,
        'primary_count': primary_count,
        'total_files': total,
        'percentage': round(percentage, 1),
        'is_mixed': percentage < 70,
        'all_counts': {k: v for k, v in counts.items() if v > 0}
    }

def verify_repo(repo_info):
    """Verify a single repository"""
    repo_name = repo_info['name']
    repo_dir_name = repo_name.replace('/', '__')
    repo_path = REPOS_DIR / repo_dir_name
    
    print(f"\n🔍 {repo_name} ({repo_info['domain']})")
    
    if not repo_path.exists():
        print(f"  ❌ NOT CLONED")
        return {
            **repo_info,
            'status': 'missing',
            'maintenance': None,
            'test_suite': None,
            'language': None
        }
    
    # Check active maintenance
    maintenance = check_active_maintenance(repo_path)
    if maintenance.get('is_active') == True:
        print(f"  ✅ Active maintenance (last commit: {maintenance['last_commit'][:10]})")
    elif maintenance.get('is_active') == False:
        print(f"  ❌ Inactive (last commit: {maintenance.get('last_commit', 'unknown')})")
    else:
        print(f"  ⚠️  Could not determine maintenance status")
    
    # Check test suite
    test_suite = check_test_suite(repo_path, repo_info['expected_lang'])
    if test_suite['has_test_suite']:
        print(f"  ✅ Test suite found ({', '.join(test_suite['found_indicators'][:2])})")
    else:
        print(f"  ❌ No test suite detected")
    
    # Check primary language
    lang_analysis = analyze_primary_language(repo_path)
    expected = repo_info['expected_lang']
    actual = lang_analysis['primary_lang']
    
    # Determine if expected matches actual
    expected_matches = False
    if expected == 'JS' and actual in ['JS', 'TS']:
        expected_matches = True
    elif expected == 'Py' and actual == 'Py':
        expected_matches = True
    elif expected == actual:
        expected_matches = True
    
    lang_status = "✅" if expected_matches else "⚠️"
    if lang_analysis['is_mixed']:
        print(f"  {lang_status} Language: Expected {expected}, Primary {actual} ({lang_analysis['percentage']}%) - MIXED")
    else:
        print(f"  {lang_status} Language: Expected {expected}, Primary {actual} ({lang_analysis['percentage']}%)")
    
    return {
        **repo_info,
        'status': 'verified',
        'maintenance': maintenance,
        'test_suite': test_suite,
        'language': lang_analysis,
        'expected_matches': expected_matches
    }

def main():
    """Main verification function"""
    print("=" * 70)
    print("REPOSITORY SELECTION VERIFICATION")
    print("=" * 70)
    
    # Parse expected repos
    print("\n📖 Parsing corpus.md...")
    expected_repos = parse_corpus()
    print(f"  Found {len(expected_repos)} repositories in corpus")
    
    # Check actual repos
    actual_repos = [d.name for d in REPOS_DIR.iterdir() if d.is_dir()]
    print(f"  Found {len(actual_repos)} repositories in .repos/")
    
    # Verify stratification
    domain_counts = defaultdict(int)
    for repo in expected_repos:
        domain_counts[repo['domain']] += 1
    
    print("\n📊 Domain Stratification:")
    all_have_8 = True
    for domain, count in sorted(domain_counts.items()):
        status = "✅" if count == 8 else "❌"
        print(f"  {status} {domain}: {count} repos")
        if count != 8:
            all_have_8 = False
    
    if all_have_8:
        print(f"  ✅ All domains have exactly 8 repositories")
    else:
        print(f"  ⚠️  Some domains do not have exactly 8 repositories")
    
    # Verify each repo
    print("\n" + "=" * 70)
    print("REPOSITORY VERIFICATION")
    print("=" * 70)
    
    results = []
    for repo in expected_repos:
        result = verify_repo(repo)
        results.append(result)
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    verified = [r for r in results if r['status'] == 'verified']
    active = [r for r in verified if r['maintenance'] and r['maintenance'].get('is_active') == True]
    inactive = [r for r in verified if r['maintenance'] and r['maintenance'].get('is_active') == False]
    unknown_maintenance = [r for r in verified if r['maintenance'] and r['maintenance'].get('is_active') not in [True, False]]
    
    with_tests = [r for r in verified if r['test_suite'] and r['test_suite']['has_test_suite']]
    without_tests = [r for r in verified if r['test_suite'] and not r['test_suite']['has_test_suite']]
    
    correct_lang = [r for r in verified if r.get('expected_matches')]
    lang_mismatch = [r for r in verified if not r.get('expected_matches')]
    
    print(f"\n  Total repositories: {len(expected_repos)}")
    print(f"  Successfully verified: {len(verified)}")
    print(f"  Missing from .repos/: {len([r for r in results if r['status'] == 'missing'])}")
    
    print(f"\n  📅 Active Maintenance (commits in last 12 months):")
    print(f"     ✅ Active: {len(active)} ({len(active)/len(verified)*100:.1f}%)")
    if inactive:
        print(f"     ❌ Inactive: {len(inactive)}")
        for r in inactive:
            print(f"        - {r['name']}")
    if unknown_maintenance:
        print(f"     ⚠️  Unknown: {len(unknown_maintenance)}")
    
    print(f"\n  🧪 Test Suite Presence:")
    print(f"     ✅ Has test suite: {len(with_tests)} ({len(with_tests)/len(verified)*100:.1f}%)")
    if without_tests:
        print(f"     ❌ No test suite: {len(without_tests)}")
        for r in without_tests:
            print(f"        - {r['name']}")
    
    print(f"\n  💻 Primary Language Match:")
    print(f"     ✅ Matches expected: {len(correct_lang)} ({len(correct_lang)/len(verified)*100:.1f}%)")
    if lang_mismatch:
        print(f"     ⚠️  Mismatch: {len(lang_mismatch)}")
        for r in lang_mismatch:
            lang = r['language']
            print(f"        - {r['name']}: Expected {r['expected_lang']}, got {lang.get('primary_lang', 'unknown')} ({lang.get('percentage', 0)}%)")
    
    # Issues
    print(f"\n  ⚠️  ISSUES REQUIRING ATTENTION:")
    issues = []
    
    for r in results:
        if r['status'] == 'missing':
            issues.append(f"  ❌ {r['name']}: Repository not cloned")
        elif r['maintenance'] and r['maintenance'].get('is_active') == False:
            issues.append(f"  ❌ {r['name']}: Inactive (last commit > 12 months ago)")
        elif r['test_suite'] and not r['test_suite']['has_test_suite']:
            issues.append(f"  ⚠️  {r['name']}: No test suite detected")
        elif not r.get('expected_matches'):
            issues.append(f"  ⚠️  {r['name']}: Language mismatch (expected {r['expected_lang']}, primary {r['language'].get('primary_lang', 'unknown')})")
    
    if issues:
        for issue in issues:
            print(issue)
    else:
        print("  None found - all repositories meet criteria ✅")
    
    # Write report
    report = {
        'timestamp': datetime.now().isoformat(),
        'summary': {
            'total': len(expected_repos),
            'verified': len(verified),
            'missing': len([r for r in results if r['status'] == 'missing']),
            'active': len(active),
            'inactive': len(inactive),
            'with_test_suite': len(with_tests),
            'without_test_suite': len(without_tests),
            'correct_language': len(correct_lang),
            'language_mismatch': len(lang_mismatch),
            'all_domains_have_8': all_have_8
        },
        'domain_stratification': dict(domain_counts),
        'results': results,
        'issues': issues
    }
    
    with open(REPORT_FILE, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Detailed report written to: {REPORT_FILE}")
    print("=" * 70)

if __name__ == '__main__':
    main()
