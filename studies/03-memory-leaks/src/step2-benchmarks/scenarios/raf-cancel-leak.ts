/**
 * Study 03 — RequestAnimationFrame Cancel Leak Scenario
 *
 * Simulates a component that uses requestAnimationFrame without
 * cancelAnimationFrame. Uses long-delay setTimeout to simulate RAF in Node
 * without CPU churn — the pending timer holds the callback reference alive.
 *
 * BAD:  Pending RAF timer keeps component + data alive (cannot be GC'd).
 * GOOD: RAF cancelled on unmount, data released (GC reclaims component).
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Simulate RAF in Node using long-delay setTimeout (holds ref, never fires)
const leakedRAFs = new Set<NodeJS.Timeout>();

class RAFComponentSimulator {
  private rafTimer: NodeJS.Timeout | null = null;
  private data: number[] = new Array(1000).fill(0).map(() => Math.random());

  mountBad() {
    // BAD: requestAnimationFrame without cancel
    this.rafTimer = setTimeout(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    }, 86_400_000); // Never fires — just holds reference chain
    leakedRAFs.add(this.rafTimer);
  }

  unmountBad() {
    // BAD: Does NOT cancel RAF
    // Timer -> callback closure -> this -> data stays alive
    this.rafTimer = null;
  }

  mountGood() {
    this.rafTimer = setTimeout(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    }, 86_400_000);
  }

  unmountGood() {
    // GOOD: Cancels RAF on unmount
    if (this.rafTimer) {
      clearTimeout(this.rafTimer);
      this.rafTimer = null;
    }
    this.data = [];
  }
}

function takeSnapshot(cycle: number): MemorySnapshot {
  if (global.gc) global.gc();
  const mem = process.memoryUsage();
  return {
    cycle,
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    rss: mem.rss,
  };
}

async function runBadPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new RAFComponentSimulator();
    component.mountBad();
    component.unmountBad();
    // component goes out of scope but pending timer keeps it alive

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  // Cleanup after measurement
  for (const timer of leakedRAFs) { clearTimeout(timer); }
  leakedRAFs.clear();
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new RAFComponentSimulator();
    component.mountGood();
    component.unmountGood();
    // Timer cancelled + data cleared -> GC reclaims component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  return snapshots;
}

export const rafCancelScenario: ScenarioDefinition = {
  name: 'raf-cancel-leak',
  framework: 'react',
  description: 'requestAnimationFrame without cancelAnimationFrame',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
