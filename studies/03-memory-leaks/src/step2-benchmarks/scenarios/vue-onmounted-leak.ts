/**
 * Study 03 — Vue onMounted Memory Leak Scenario
 *
 * Simulates a Vue component that sets up a timer in onMounted without cleanup in onUnmounted.
 * The "bad" version leaks because the timer continues running after unmount.
 * The "good" version clears the timer in onUnmounted.
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

const activeTimers = new Set<NodeJS.Timeout>();

function trackTimer(timer: NodeJS.Timeout) {
  activeTimers.add(timer);
}

function untrackTimer(timer: NodeJS.Timeout | null) {
  if (!timer) return;
  if (activeTimers.has(timer)) {
    activeTimers.delete(timer);
  }
}

function cleanupLeakedTimers() {
  for (const timer of activeTimers) {
    clearInterval(timer);
  }
  activeTimers.clear();
}

// Simulate a Vue component with a timer subscription
class VueComponentSimulator {
  private timerId: NodeJS.Timeout | null = null;
  // Larger data structure to make leaks measurable
  private data: number[] = new Array(2500).fill(0).map(() => Math.random());

  mountBad() {
    // BAD: setInterval without cleanup
    this.timerId = setInterval(() => {
      // Simulate work that captures component data in closure
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    }, 10);
    trackTimer(this.timerId);
  }

  unmountBad() {
    // BAD: Does NOT clear the interval
    // The timer continues firing, holding references to the component
    this.timerId = null;
  }

  mountGood() {
    // GOOD: setInterval with cleanup tracking
    this.timerId = setInterval(() => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    }, 10);
    trackTimer(this.timerId);
  }

  unmountGood() {
    // GOOD: Clears the interval on unmount
    if (this.timerId) {
      clearInterval(this.timerId);
      untrackTimer(this.timerId);
      this.timerId = null;
    }
    this.data = [];
  }
}

function takeSnapshot(cycle: number, forceGC: boolean = false): MemorySnapshot {
  // Only force GC at baseline
  if (forceGC && global.gc) global.gc();
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
  // Keep components alive to accumulate leaked timers
  const components: VueComponentSimulator[] = [];
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new VueComponentSimulator();
    component.mountBad();
    // Let the timer fire a few times
    await new Promise(resolve => setTimeout(resolve, 50));
    component.unmountBad(); // Does NOT clear timer
    
    // Keep component alive so timer+closure persist
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i)); // No GC during measurement
    }
  }

  // Clean up only after final snapshot
  cleanupLeakedTimers();
  components.length = 0;
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  const components: VueComponentSimulator[] = [];
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new VueComponentSimulator();
    component.mountGood();
    await new Promise(resolve => setTimeout(resolve, 50));
    component.unmountGood(); // DOES clear timer properly
    
    // Keep component alive to match memory profile
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  components.length = 0;
  return snapshots;
}

export const vueOnMountedScenario: ScenarioDefinition = {
  name: 'vue-onmounted-leak',
  framework: 'vue',
  description: 'onMounted sets timer without onUnmounted cleanup',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
