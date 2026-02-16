/**
 * Study 03 — Angular Subscribe Memory Leak Scenario
 *
 * Simulates an Angular component that subscribes to an observable without
 * unsubscribing in ngOnDestroy. The Observable holds subscriber callback
 * references (no active timer), so leaked subscriptions keep components alive.
 *
 * BAD:  Subscription callback keeps component + state alive via Observable.
 * GOOD: Unsubscribes on destroy, releases data (GC reclaims component).
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Simple observable simulator (mimics RxJS Subject) — no active timer
class Observable {
  private subscribers: Array<(value: any) => void> = [];

  subscribe(callback: (value: any) => void): { unsubscribe: () => void } {
    this.subscribers.push(callback);
    return {
      unsubscribe: () => {
        const idx = this.subscribers.indexOf(callback);
        if (idx >= 0) this.subscribers.splice(idx, 1);
      },
    };
  }

  destroy() {
    this.subscribers = [];
  }
}

class AngularComponentSimulator {
  constructor(private dataService: Observable) {}

  private subscription: { unsubscribe: () => void } | null = null;
  private componentState: number[] = new Array(1000).fill(0).map(() => Math.random());

  ngOnInitBad() {
    // BAD: subscribe without storing subscription
    this.dataService.subscribe(() => {
      // Closure captures this -> componentState, keeping component alive
      this.componentState.forEach((v, i) => this.componentState[i] = v * 1.001);
    });
  }

  ngOnDestroyBad() {
    // BAD: Does NOT unsubscribe
    // Observable -> callback closure -> this -> componentState stays alive
  }

  ngOnInitGood() {
    // GOOD: subscribe and store subscription
    this.subscription = this.dataService.subscribe(() => {
      this.componentState.forEach((v, i) => this.componentState[i] = v * 1.001);
    });
  }

  ngOnDestroyGood() {
    // GOOD: Unsubscribes on destroy, releases data
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.componentState = [];
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
  const dataService = new Observable();
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new AngularComponentSimulator(dataService);
    component.ngOnInitBad();
    component.ngOnDestroyBad();
    // component goes out of scope but Observable holds callback -> component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  // Cleanup after measurement
  dataService.destroy();
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  const dataService = new Observable();
  snapshots.push(takeSnapshot(0));

  for (let i = 1; i <= cycles; i++) {
    const component = new AngularComponentSimulator(dataService);
    component.ngOnInitGood();
    component.ngOnDestroyGood();
    // Subscription removed + data cleared -> GC reclaims component

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  dataService.destroy();
  return snapshots;
}

export const angularSubscribeScenario: ScenarioDefinition = {
  name: 'angular-subscribe-leak',
  framework: 'angular',
  description: 'Component subscribes without unsubscribe in ngOnDestroy',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
