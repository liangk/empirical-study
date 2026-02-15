/**
 * Study 03 — React useEffect Memory Leak Scenario
 *
 * Simulates a component that adds an event listener in useEffect without cleanup.
 * The "bad" version leaks because the listener persists after unmount.
 * The "good" version returns a cleanup function that removes the listener.
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Provide a window-like object in both browser and Node environments.
const windowLike: { addEventListener?: (...args: any[]) => void; removeEventListener?: (...args: any[]) => void } | undefined =
  typeof globalThis !== 'undefined'
    ? (globalThis as any).window ?? (globalThis as any)
    : undefined;

// Simulate a component that subscribes to window resize events
class ComponentSimulator {
  private listeners: Array<() => void> = [];
  // Capture significant data to make leaks measurable (simulate component state)
  private data: number[] = new Array(2500).fill(0).map(() => Math.random());

  mountBad() {
    // BAD: addEventListener without cleanup
    const handler = () => {
      // Capture component data in closure (simulates real React closures over state)
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    };
    this.listeners.push(handler);
    if (windowLike?.addEventListener) {
      windowLike.addEventListener('resize', handler);
    }
  }

  unmountBad() {
    // BAD: Does NOT remove the listener
    // The handler closure remains in memory, referencing the component
  }

  mountGood() {
    // GOOD: addEventListener with cleanup tracking
    const handler = () => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    };
    this.listeners.push(handler);
    if (windowLike?.addEventListener) {
      windowLike.addEventListener('resize', handler);
    }
  }

  unmountGood() {
    // GOOD: Removes all listeners on unmount
    if (windowLike?.removeEventListener) {
      for (const listener of this.listeners) {
        windowLike.removeEventListener('resize', listener);
      }
    }
    this.listeners = [];
  }
}

function takeSnapshot(cycle: number, forceGC: boolean = false): MemorySnapshot {
  // Only force GC at baseline to avoid erasing leak signal
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
  // Keep component instances alive to accumulate leaks
  const components: ComponentSimulator[] = [];
  
  // Baseline snapshot with forced GC
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new ComponentSimulator();
    component.mountBad();
    // Simulate some component lifetime
    await new Promise(resolve => setImmediate(resolve));
    component.unmountBad(); // Does NOT clean up listeners
    
    // Keep component alive so listeners+closures remain in memory
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i)); // No forced GC during measurement
    }
  }

  // Cleanup only after final snapshot
  if (windowLike?.removeEventListener) {
    for (const comp of components) {
      for (const listener of (comp as any).listeners) {
        windowLike.removeEventListener('resize', listener);
      }
    }
  }
  components.length = 0;

  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  const components: ComponentSimulator[] = [];
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new ComponentSimulator();
    component.mountGood();
    await new Promise(resolve => setImmediate(resolve));
    component.unmountGood(); // DOES clean up listeners
    
    // Still keep component alive to match memory profile of bad variant
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  components.length = 0;
  return snapshots;
}

export const reactUseEffectScenario: ScenarioDefinition = {
  name: 'react-useeffect-leak',
  framework: 'react',
  description: 'useEffect adds event listener without cleanup return',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
