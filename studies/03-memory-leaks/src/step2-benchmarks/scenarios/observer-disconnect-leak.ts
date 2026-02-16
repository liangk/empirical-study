/**
 * Study 03 — Observer API Memory Leak Scenario
 *
 * Simulates a component that creates IntersectionObserver/MutationObserver without disconnect.
 * The "bad" version leaks because observers remain active after unmount.
 * The "good" version calls disconnect() on unmount.
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Simulate a component that observes DOM elements
class ObserverComponentSimulator {
  private observers: Array<IntersectionObserver | MutationObserver> = [];
  private data: number[] = new Array(5000).fill(0).map(() => Math.random());

  mountBad() {
    // BAD: Create observers without disconnect
    // Simulate intersection observer
    const intersectionObs = new IntersectionObserver((entries) => {
      // Capture component data in callback
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    });
    
    // Create dummy target elements to observe
    const target1 = document.createElement('div');
    intersectionObs.observe(target1);
    
    // Simulate mutation observer
    const mutationObs = new MutationObserver((mutations) => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    });
    
    const target2 = document.createElement('div');
    mutationObs.observe(target2, { attributes: true, childList: true });
    
    this.observers.push(intersectionObs, mutationObs);
  }

  unmountBad() {
    // BAD: Does NOT disconnect observers
    // Observers continue watching, holding references
  }

  mountGood() {
    // GOOD: Create observers with disconnect tracking
    const intersectionObs = new IntersectionObserver((entries) => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    });
    
    const target1 = document.createElement('div');
    intersectionObs.observe(target1);
    
    const mutationObs = new MutationObserver((mutations) => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    });
    
    const target2 = document.createElement('div');
    mutationObs.observe(target2, { attributes: true, childList: true });
    
    this.observers.push(intersectionObs, mutationObs);
  }

  unmountGood() {
    // GOOD: Disconnects all observers on unmount
    for (const obs of this.observers) {
      obs.disconnect();
    }
    this.observers = [];
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
  // Keep components alive to accumulate leaked observers
  const components: ObserverComponentSimulator[] = [];
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new ObserverComponentSimulator();
    component.mountBad();
    await new Promise(resolve => setImmediate(resolve));
    component.unmountBad(); // Does NOT disconnect
    
    // Keep component alive so observers+closures persist
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  // Cleanup only after final snapshot
  for (const comp of components) {
    for (const obs of (comp as any).observers) {
      obs.disconnect();
    }
  }
  components.length = 0;

  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  const components: ObserverComponentSimulator[] = [];
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new ObserverComponentSimulator();
    component.mountGood();
    await new Promise(resolve => setImmediate(resolve));
    component.unmountGood(); // DOES disconnect properly
    
    // Still keep component alive to match memory profile
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  components.length = 0;
  return snapshots;
}

export const observerDisconnectScenario: ScenarioDefinition = {
  name: 'observer-disconnect-leak',
  framework: 'react', // Applies to all frameworks
  description: 'IntersectionObserver/MutationObserver without disconnect',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
