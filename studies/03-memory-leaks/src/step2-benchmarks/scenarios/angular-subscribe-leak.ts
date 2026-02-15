/**
 * Study 03 — Angular Subscribe Memory Leak Scenario
 *
 * Simulates an Angular component that subscribes to an observable without unsubscribing in ngOnDestroy.
 * The "bad" version leaks because the subscription remains active after component destruction.
 * The "good" version stores the subscription and unsubscribes in ngOnDestroy.
 */

import type { ScenarioDefinition, MemorySnapshot } from '../run-all';

// Simple observable simulator (mimics RxJS behavior)
class Observable {
  private subscribers: Array<(value: any) => void> = [];
  private interval: NodeJS.Timeout | null = null;

  constructor() {
    // Emit values periodically with larger payloads
    this.interval = setInterval(() => {
      const value = { data: new Array(500).fill(0).map(() => Math.random()) };
      for (const sub of this.subscribers) {
        sub(value);
      }
    }, 10);
  }

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
    if (this.interval) clearInterval(this.interval);
    this.subscribers = [];
  }
}

// Simulate an Angular component with subscription
class AngularComponentSimulator {
  constructor(private dataService: Observable) {}

  private subscription: { unsubscribe: () => void } | null = null;
  // Larger data structure to make leaks measurable
  private receivedData: any[] = [];
  private componentState: number[] = new Array(2500).fill(0).map(() => Math.random());

  ngOnInitBad() {
    // BAD: subscribe without storing subscription
    this.dataService.subscribe((data) => {
      // Capture component state in subscription closure
      this.componentState.forEach((v, i) => this.componentState[i] = v * 1.001);
      this.receivedData.push(data);
      if (this.receivedData.length > 50) {
        this.receivedData = this.receivedData.slice(-25);
      }
    });
  }

  ngOnDestroyBad() {
    // BAD: Does NOT unsubscribe
    // The subscription callback continues firing, holding reference to component
  }

  ngOnInitGood() {
    // GOOD: subscribe and store subscription
    this.subscription = this.dataService.subscribe((data) => {
      this.componentState.forEach((v, i) => this.componentState[i] = v * 1.001);
      this.receivedData.push(data);
      if (this.receivedData.length > 50) {
        this.receivedData = this.receivedData.slice(-25);
      }
    });
  }

  ngOnDestroyGood() {
    // GOOD: Unsubscribes on destroy
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.receivedData = [];
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
  // Keep components alive to accumulate leaked subscriptions
  const components: AngularComponentSimulator[] = [];
  const dataService = new Observable();
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new AngularComponentSimulator(dataService);
    component.ngOnInitBad();
    // Let subscription fire a few times
    await new Promise(resolve => setTimeout(resolve, 50));
    component.ngOnDestroyBad(); // Does NOT unsubscribe
    
    // Keep component alive so subscription+closure persist
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i)); // No GC during measurement
    }
  }

  // Clean up only after final snapshot
  dataService.destroy();
  components.length = 0;
  return snapshots;
}

async function runGoodPattern(cycles: number): Promise<MemorySnapshot[]> {
  const snapshots: MemorySnapshot[] = [];
  const components: AngularComponentSimulator[] = [];
  const dataService = new Observable();
  
  snapshots.push(takeSnapshot(0, true));

  for (let i = 1; i <= cycles; i++) {
    const component = new AngularComponentSimulator(dataService);
    component.ngOnInitGood();
    await new Promise(resolve => setTimeout(resolve, 50));
    component.ngOnDestroyGood(); // DOES unsubscribe properly
    
    // Keep component alive to match memory profile
    components.push(component);

    if (i % 10 === 0) {
      snapshots.push(takeSnapshot(i));
    }
  }

  dataService.destroy();
  components.length = 0;
  return snapshots;
}

export const angularSubscribeScenario: ScenarioDefinition = {
  name: 'angular-subscribe-leak',
  framework: 'angular',
  description: 'Component subscribes without unsubscribe in ngOnDestroy',
  runBad: runBadPattern,
  runGood: runGoodPattern,
};
