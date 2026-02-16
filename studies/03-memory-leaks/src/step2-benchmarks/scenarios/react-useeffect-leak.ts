/**
 * Study 03 — React useEffect Memory Leak Scenario
 *
 * Simulates a component that adds an event listener in useEffect without cleanup.
 * The "bad" version leaks because the listener persists after unmount.
 * The "good" version returns a cleanup function that removes the listener.
 *
 * Uses Node EventEmitter to simulate browser window events (addEventListener
 * does not exist in Node). The leaked listener closure keeps the component
 * and its data array alive, preventing GC.
 */

import { EventEmitter } from 'events';
import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Simulate browser's window event target using Node EventEmitter
const windowEmitter = new EventEmitter();
windowEmitter.setMaxListeners(0); // Suppress MaxListenersExceeded warning

class ComponentSimulator {
  private data: number[] = new Array(1000).fill(0).map(() => Math.random());
  private handler: ((...args: any[]) => void) | null = null;

  mountBad() {
    // BAD: addEventListener without cleanup return
    this.handler = () => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    };
    windowEmitter.on('resize', this.handler);
  }

  unmountBad() {
    // BAD: Does NOT remove the listener
    // windowEmitter -> handler closure -> this -> data stays alive
  }

  mountGood() {
    // GOOD: addEventListener with cleanup tracking
    this.handler = () => {
      this.data.forEach((v, i) => this.data[i] = v * 1.001);
    };
    windowEmitter.on('resize', this.handler);
  }

  unmountGood() {
    // GOOD: Removes listener on unmount, releases data
    if (this.handler) {
      windowEmitter.removeListener('resize', this.handler);
      this.handler = null;
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
    const component = new ComponentSimulator();
    component.mountBad();
    component.unmountBad();
    // component goes out of scope but handler keeps it alive via windowEmitter

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  // Cleanup after measurement
  windowEmitter.removeAllListeners('resize');
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new ComponentSimulator();
    component.mountGood();
    component.unmountGood();
    // Listener removed + data cleared -> GC reclaims component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  return snapshots;
}

export const reactUseEffectScenario: ScenarioDefinition = {
  name: 'react-useeffect-leak',
  framework: 'react',
  description: 'useEffect adds event listener without cleanup return',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
