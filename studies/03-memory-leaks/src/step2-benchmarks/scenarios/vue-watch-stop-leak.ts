/**
 * Study 03 — Vue watch/watchEffect Stop Handle Leak Scenario
 *
 * Simulates a Vue component that creates watch/watchEffect without storing
 * the stop handle. The watcher registry holds callback references (no active
 * timer), so leaked watchers keep components alive.
 *
 * BAD:  Watcher callback keeps component + data alive via registry.
 * GOOD: Stop handle called on unmount, data released (GC reclaims component).
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Simulate Vue reactive watch/watchEffect system — no active timer
class ReactiveWatcher {
  private watchers: Array<{ callback: () => void }> = [];

  watch(callback: () => void): () => void {
    const entry = { callback };
    this.watchers.push(entry);
    return () => {
      const idx = this.watchers.indexOf(entry);
      if (idx >= 0) this.watchers.splice(idx, 1);
    };
  }

  destroy() {
    this.watchers = [];
  }
}

class VueWatchComponentSimulator {
  private stopHandles: Array<() => void> = [];
  private data: number[] = new Array(1000).fill(0).map(() => Math.random());

  constructor(private watcher: ReactiveWatcher) {}

  mountBad() {
    // BAD: watch/watchEffect without storing stop handle
    this.watcher.watch(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    });
  }

  unmountBad() {
    // BAD: Does NOT call stop handle
    // ReactiveWatcher -> callback -> this -> data stays alive
  }

  mountGood() {
    // GOOD: watch/watchEffect with stop handle stored
    const stop = this.watcher.watch(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    });
    this.stopHandles.push(stop);
  }

  unmountGood() {
    // GOOD: Calls all stop handles on unmount
    for (const stop of this.stopHandles) { stop(); }
    this.stopHandles = [];
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
  const watcher = new ReactiveWatcher();
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new VueWatchComponentSimulator(watcher);
    component.mountBad();
    component.unmountBad();
    // component goes out of scope but watcher registry keeps callback -> component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  // Cleanup after measurement
  watcher.destroy();
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  const watcher = new ReactiveWatcher();
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new VueWatchComponentSimulator(watcher);
    component.mountGood();
    component.unmountGood();
    // Watcher stopped + data cleared -> GC reclaims component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  watcher.destroy();
  return snapshots;
}

export const vueWatchStopScenario: ScenarioDefinition = {
  name: 'vue-watch-stop-leak',
  framework: 'vue',
  description: 'watch/watchEffect without stop handle cleanup',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
