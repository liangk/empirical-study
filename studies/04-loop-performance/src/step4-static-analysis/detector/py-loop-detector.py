"""
py-loop-detector.py — Study 04: Phase 4 / Phase 5
AST-based detector for loop anti-patterns in Python source files.

Anti-patterns detected:
  - regex-in-loop        : re.compile() / re.match() / re.search() etc. inside a loop
  - json-parse-in-loop   : json.loads() / json.load() inside a loop
  - nested-loops         : for/while nested >= 2 levels deep
  - sequential-await     : `await` expressions inside a for/async for loop (asyncio)
  - nested-comprehension : list/dict/set comprehension nested inside another loop

Usage:
  python py-loop-detector.py --path <dir_or_file> [--output <json_file>] [--min-severity low|medium|high]

Output (stdout + optional JSON):
  Per-file findings with file, line, kind, severity, snippet.
"""

import ast
import json
import os
import sys
import argparse
from dataclasses import dataclass, asdict
from typing import List, Optional

LOOP_TYPES = (ast.For, ast.While, ast.AsyncFor)
ARRAY_METHOD_NAMES = {"map", "filter", "reduce", "forEach", "find", "findIndex", "some", "every"}

RE_CALL_NAMES = {"compile", "match", "search", "fullmatch", "findall", "finditer", "sub", "subn", "split"}


@dataclass
class PyLoopIssue:
    file: str
    line: int
    col: int
    kind: str
    severity: str
    description: str
    snippet: str


def get_snippet(source_lines: List[str], lineno: int, max_len: int = 120) -> str:
    if 1 <= lineno <= len(source_lines):
        return source_lines[lineno - 1].strip()[:max_len]
    return ""


def is_re_call(node: ast.expr) -> bool:
    """Return True if node is a call to re.<method>() or re.compile()."""
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Attribute):
        if isinstance(func.value, ast.Name) and func.value.id == "re":
            return func.attr in RE_CALL_NAMES
    if isinstance(func, ast.Name) and func.id == "compile":
        return True
    return False


def is_json_load_call(node: ast.expr) -> bool:
    """Return True if node is json.loads() or json.load()."""
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if isinstance(func, ast.Attribute):
        if isinstance(func.value, ast.Name) and func.value.id == "json":
            return func.attr in {"loads", "load"}
    return False


class LoopDepthVisitor(ast.NodeVisitor):
    def __init__(self, source_lines: List[str], filepath: str):
        self.source_lines = source_lines
        self.filepath = filepath
        self.issues: List[PyLoopIssue] = []
        self._loop_depth = 0
        self._in_async_loop = False

    def _push_loop(self, is_async: bool = False):
        self._loop_depth += 1
        if is_async:
            self._in_async_loop = True

    def _pop_loop(self, was_async: bool = False):
        self._loop_depth -= 1
        if was_async:
            self._in_async_loop = False

    def _add(self, node: ast.AST, kind: str, severity: str, description: str):
        lineno = getattr(node, "lineno", 0)
        col = getattr(node, "col_offset", 0)
        self.issues.append(PyLoopIssue(
            file=self.filepath,
            line=lineno,
            col=col,
            kind=kind,
            severity=severity,
            description=description,
            snippet=get_snippet(self.source_lines, lineno),
        ))

    def _visit_loop_body(self, node: ast.stmt, is_async: bool = False):
        self._push_loop(is_async)
        self.generic_visit(node)
        self._pop_loop(is_async)

    def visit_For(self, node: ast.For):
        if self._loop_depth >= 1:
            self._add(node, "nested-loops",
                      "high" if self._loop_depth >= 2 else "medium",
                      f"Nested for-loop at depth {self._loop_depth + 1} — potential O(n²). Consider dict/set substitution.")
        self._visit_loop_body(node)

    def visit_While(self, node: ast.While):
        if self._loop_depth >= 1:
            self._add(node, "nested-loops",
                      "high" if self._loop_depth >= 2 else "medium",
                      f"Nested while-loop at depth {self._loop_depth + 1} — potential O(n²).")
        self._visit_loop_body(node)

    def visit_AsyncFor(self, node: ast.AsyncFor):
        if self._loop_depth >= 1:
            self._add(node, "nested-loops", "medium",
                      f"Nested async for-loop at depth {self._loop_depth + 1}.")
        self._visit_loop_body(node, is_async=True)

    def visit_Call(self, node: ast.Call):
        if self._loop_depth >= 1:
            if is_re_call(node):
                self._add(node, "regex-in-loop", "high",
                          "re call inside loop — regex compiled on every iteration. Hoist re.compile() outside loop.")
            if is_json_load_call(node):
                self._add(node, "json-parse-in-loop", "high",
                          "json.loads()/json.load() inside loop — parse once before the loop and reuse result.")
        self.generic_visit(node)

    def visit_Await(self, node: ast.Await):
        if self._loop_depth >= 1:
            self._add(node, "sequential-await-in-loop", "high",
                      "await inside loop — sequential async I/O. Use asyncio.gather() for parallel execution.")
        self.generic_visit(node)

    def visit_ListComp(self, node: ast.ListComp):
        if self._loop_depth >= 1:
            self._add(node, "nested-comprehension", "medium",
                      "List comprehension inside loop — creates intermediate list on every iteration. Consider generator or restructuring.")
        self.generic_visit(node)

    def visit_DictComp(self, node: ast.DictComp):
        if self._loop_depth >= 1:
            self._add(node, "nested-comprehension", "medium",
                      "Dict comprehension inside loop — creates intermediate dict on every iteration.")
        self.generic_visit(node)

    def visit_SetComp(self, node: ast.SetComp):
        if self._loop_depth >= 1:
            self._add(node, "nested-comprehension", "medium",
                      "Set comprehension inside loop — creates intermediate set on every iteration.")
        self.generic_visit(node)


def detect_file(filepath: str) -> List[PyLoopIssue]:
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            source = f.read()
    except OSError:
        return []

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError:
        return []

    source_lines = source.splitlines()
    visitor = LoopDepthVisitor(source_lines, filepath)
    visitor.visit(tree)
    return visitor.issues


def collect_py_files(root: str) -> List[str]:
    result = []
    skip_dirs = {".git", "__pycache__", ".tox", "node_modules", ".venv", "venv", "env", "dist", "build"}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs]
        for fname in filenames:
            if fname.endswith(".py"):
                result.append(os.path.join(dirpath, fname))
    return result


SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2}


def main():
    parser = argparse.ArgumentParser(description="Python loop anti-pattern detector for Study 04.")
    parser.add_argument("--path", required=True, help="Directory or .py file to scan.")
    parser.add_argument("--output", default=None, help="Optional JSON output file path.")
    parser.add_argument("--min-severity", default="low", choices=["low", "medium", "high"],
                        help="Minimum severity to report (default: low).")
    parser.add_argument("--top", type=int, default=30, help="Max issues to print to stdout (default: 30).")
    args = parser.parse_args()

    target = args.path
    min_sev = SEVERITY_ORDER[args.min_severity]

    if os.path.isfile(target):
        py_files = [target]
    elif os.path.isdir(target):
        py_files = collect_py_files(target)
    else:
        print(f"Error: path not found: {target}", file=sys.stderr)
        sys.exit(1)

    print(f"\n=== Study 04: Phase 4 — Python Loop Anti-Pattern Detector ===")
    print(f"Scanning {len(py_files)} Python files in: {target}\n")

    all_issues: List[PyLoopIssue] = []
    for fp in py_files:
        issues = detect_file(fp)
        all_issues.extend(issues)

    filtered = [i for i in all_issues if SEVERITY_ORDER[i.severity] >= min_sev]

    counts: dict = {}
    for issue in filtered:
        counts[issue.kind] = counts.get(issue.kind, 0) + 1

    print("--- Detection Summary ---")
    print(f"Files scanned     : {len(py_files)}")
    print(f"Total findings    : {len(filtered)}")
    print()
    print(f"{'Anti-Pattern':<35} | Count")
    print("-" * 50)
    for kind, count in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"  {kind:<33} | {count}")
    print("-" * 50)
    print(f"  {'TOTAL':<33} | {len(filtered)}")

    top_n = args.top
    print(f"\n--- Top Issues ({min(top_n, len(filtered))} of {len(filtered)}) ---")
    shown = 0
    for issue in sorted(filtered, key=lambda i: -SEVERITY_ORDER[i.severity]):
        if shown >= top_n:
            break
        rel = os.path.relpath(issue.file, target) if os.path.isdir(target) else issue.file
        print(f"  [{issue.severity.upper()}] {issue.kind} @ {rel}:{issue.line}")
        print(f"    {issue.snippet}")
        shown += 1

    if args.output:
        out_data = {
            "tool": "py-loop-detector",
            "path": target,
            "files_scanned": len(py_files),
            "total_findings": len(filtered),
            "counts_by_kind": counts,
            "findings": [asdict(i) for i in filtered],
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(out_data, f, indent=2)
        print(f"\nResults written to: {args.output}")

    print(f"\nNext steps:")
    print(f"  1. Review high-severity findings manually")
    print(f"  2. Select top 3 per pattern for §4.4 real-world measurement")
    print(f"  3. Cross-reference with JS findings in results/findings-*.json")


if __name__ == "__main__":
    main()
