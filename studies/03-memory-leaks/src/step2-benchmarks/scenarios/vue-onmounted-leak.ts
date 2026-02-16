/**
 * Study 03 — Vue onMounted Memory Leak Scenario
 *
 * Simulates a Vue component that sets up a timer in onMounted without cleanup
 * in onUnmounted. Uses long-delay timers that hold references without firing,
 * so measurements are not polluted by timer callback churn.
 *
 * BAD:  Timer closure keeps component + data alive (cannot be GC'd).
 * GOOD: Timer cleared on unmount, data released (GC reclaims component).
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Track leaked timers for post-measurement cleanup only
const leakedTimers = new Set<NodeJS.Timeout>();

class VueComponentSimulator {
  private timerId: NodeJS.Timeout | null = null;
  private data: number[] = new Array(1000).fill(0).map(() => Math.random());

  mountBad() {
    // BAD: setInterval without cleanup — long delay prevents firing during bench
    this.timerId = setInterval(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    }, 86_400_000); // 24h — never fires, just holds reference chain
    leakedTimers.add(this.timerId);
  }

  unmountBad() {
    // BAD: Does NOT clear the interval
    // Timer -> callback closure -> this -> data stays alive
    this.timerId = null;
  }

  mountGood() {
    this.timerId = setInterval(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    }, 86_400_000);
  }

  unmountGood() {
    // GOOD: Clears the interval on unmount
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
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
    const component = new VueComponentSimulator();
    component.mountBad();
    component.unmountBad();
    // component goes out of scope but timer keeps it alive

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  // Cleanup after measurement
  for (const timer of leakedTimers) { clearInterval(timer); }
  leakedTimers.clear();
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new VueComponentSimulator();
    component.mountGood();
    component.unmountGood();
    // Timer cleared + data released -> GC reclaims component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  return snapshots;
}

export const vueOnMountedScenario: ScenarioDefinition = {
  name: 'vue-onmounted-leak',
  framework: 'vue',
  description: 'onMounted sets timer without onUnmounted cleanup',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
