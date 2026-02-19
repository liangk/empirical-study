"""
py-bench.py — Study 04: Python loop performance benchmarks
Mirrors BM-01 (regex-in-loop) and BM-04 (nested loops → dict lookup) in CPython.

CPython does NOT JIT-compile loops, so results may differ significantly from V8.

Usage:
  python src/step4-static-analysis/detector/py-bench.py [--output results/py-bench.json]
"""
import re
import time
import json
import os
import sys
import gc
import math
import argparse
import random
from typing import List, Dict, Any

TRIALS = 30
WARMUP = 10
N_VALUES = [10, 100, 1000, 10000, 100000]
SEED = 0xBEEF01

# ─── Data generators ──────────────────────────────────────────────────────────

def gen_bm01_data(n: int) -> List[str]:
    rng = random.Random(SEED)
    result = []
    for _ in range(n):
        if rng.random() < 0.8:
            y = 2000 + rng.randint(0, 23)
            m = str(rng.randint(1, 12)).zfill(2)
            d = str(rng.randint(1, 28)).zfill(2)
            result.append(f"{y}-{m}-{d}")
        else:
            chars = "abcdefghijklmnopqrstuvwxyz0123456789"
            result.append("".join(rng.choice(chars) for _ in range(10)))
    return result


def gen_bm04_data(n: int):
    rng = random.Random(0xBEEF04)
    users = [{"id": i + 1, "name": f"user_{i+1}"} for i in range(n)]
    orders = [{"userId": rng.randint(1, n), "amount": rng.randint(0, 9999)} for _ in range(n)]
    return users, orders


# ─── BM-01 variants ───────────────────────────────────────────────────────────

def bm01_baseline(strings: List[str]) -> int:
    """Regex compiled inside loop — new pattern object on every call."""
    count = 0
    for s in strings:
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            count += 1
    return count


def bm01_optimized(strings: List[str]) -> int:
    """Regex compiled once outside loop — reused across all iterations."""
    pattern = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    count = 0
    for s in strings:
        if pattern.match(s):
            count += 1
    return count


# ─── BM-04 variants ───────────────────────────────────────────────────────────

def bm04_baseline(users, orders):
    """O(n²) nested loop — linear scan through orders for each user."""
    results = []
    for user in users:
        found = None
        for order in orders:
            if order["userId"] == user["id"]:
                found = order
                break
        results.append(found)
    return results


def bm04_optimized(users, orders):
    """O(n) dict lookup — pre-build dict keyed by userId."""
    order_map: Dict[int, Any] = {}
    for o in orders:
        if o["userId"] not in order_map:
            order_map[o["userId"]] = o
    return [order_map.get(u["id"]) for u in users]


# ─── Harness ──────────────────────────────────────────────────────────────────

def run_trials(fn, data_args, trials: int, warmup: int):
    # Warmup
    for _ in range(warmup):
        fn(*data_args)

    times = []
    for _ in range(trials):
        gc.collect()
        t0 = time.perf_counter_ns()
        fn(*data_args)
        t1 = time.perf_counter_ns()
        times.append((t1 - t0) / 1e6)  # ms

    m = sum(times) / len(times)
    s = math.sqrt(sum((x - m) ** 2 for x in times) / len(times))
    cv = (s / m * 100) if m > 0 else 0
    return {"mean_ms": round(m, 4), "std_ms": round(s, 4), "cv_pct": round(cv, 2), "trials": trials}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    results = []

    print(f"\n=== Study 04: Python Loop Benchmarks (CPython {sys.version.split()[0]}) ===")
    print(f"Trials: {TRIALS} | Warmup: {WARMUP} | n: {N_VALUES}\n")

    # ── BM-01 ──
    print("--- BM-01: Regex-in-Loop vs Hoisted Regex ---")
    print(f"{'n':>8} | {'baseline ms':>12} | {'optimized ms':>12} | {'speedup':>8} | {'base CV%':>8} | {'opt CV%':>8}")
    print("-" * 75)

    for n in N_VALUES:
        data = gen_bm01_data(n)
        base = run_trials(bm01_baseline, [data], TRIALS, WARMUP)
        opt = run_trials(bm01_optimized, [data], TRIALS, WARMUP)
        speedup = base["mean_ms"] / opt["mean_ms"] if opt["mean_ms"] > 0 else float("inf")
        print(f"{n:>8} | {base['mean_ms']:>12.4f} | {opt['mean_ms']:>12.4f} | {speedup:>8.2f}x | {base['cv_pct']:>8.1f} | {opt['cv_pct']:>8.1f}")
        results.append({"module": "BM-01", "n": n, "baseline": base, "optimized": opt, "speedup": round(speedup, 3)})

    # ── BM-04 ──
    print(f"\n--- BM-04: Nested Loop (O(n²)) vs Dict Lookup (O(n)) ---")
    print(f"{'n':>8} | {'baseline ms':>12} | {'optimized ms':>12} | {'speedup':>8} | {'base CV%':>8} | {'opt CV%':>8}")
    print("-" * 75)

    for n in N_VALUES:
        if n > 10000:
            print(f"{n:>8} | {'(skipped — too slow)':>40}")
            continue
        users, orders = gen_bm04_data(n)
        base = run_trials(bm04_baseline, [users, orders], TRIALS, WARMUP)
        opt = run_trials(bm04_optimized, [users, orders], TRIALS, WARMUP)
        speedup = base["mean_ms"] / opt["mean_ms"] if opt["mean_ms"] > 0 else float("inf")
        print(f"{n:>8} | {base['mean_ms']:>12.4f} | {opt['mean_ms']:>12.4f} | {speedup:>8.2f}x | {base['cv_pct']:>8.1f} | {opt['cv_pct']:>8.1f}")
        results.append({"module": "BM-04", "n": n, "baseline": base, "optimized": opt, "speedup": round(speedup, 3)})

    print("\n=== Summary ===")
    print(f"{'Module':>8} | {'n':>8} | {'speedup':>10}")
    print("-" * 35)
    for r in results:
        print(f"{r['module']:>8} | {r['n']:>8} | {r['speedup']:>10.2f}x")

    if args.output:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w") as f:
            json.dump({
                "tool": "py-bench",
                "python_version": sys.version.split()[0],
                "trials": TRIALS,
                "warmup": WARMUP,
                "n_values": N_VALUES,
                "results": results,
            }, f, indent=2)
        print(f"\nResults written to: {args.output}")


if __name__ == "__main__":
    main()
