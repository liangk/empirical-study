import { generateBm07Data } from '../../harness/data-gen';

/**
 * BM-07 Node-side runner — correctness verification only.
 * Uses a plain JS object to simulate a minimal DOM container.
 * Production DOM performance measurements must be done in a real browser
 * using baseline.html / optimized.html with Chrome DevTools Performance tab.
 */

interface MockElement {
  innerHTML: string;
  children: string[];
}

function makeMockList(): MockElement {
  return { innerHTML: '', children: [] };
}

/** Simulates innerHTML += `<li>...</li>` accumulation. */
export function runBaseline(n: number): MockElement {
  const items = generateBm07Data(n);
  const list = makeMockList();
  for (let i = 0; i < items.length; i++) {
    list.innerHTML += `<li>${items[i]}</li>`;
  }
  list.children = items.map((it: string) => `<li>${it}</li>`);
  return list;
}

/** Simulates DocumentFragment batch — collects all nodes, appends once. */
export function runOptimized(n: number): MockElement {
  const items = generateBm07Data(n);
  const list = makeMockList();
  const fragment: string[] = [];
  for (let i = 0; i < items.length; i++) {
    fragment.push(`<li>${items[i]}</li>`);
  }
  list.innerHTML = fragment.join('');
  list.children = fragment;
  return list;
}

/** Correctness check: both variants must produce the same innerHTML. */
export function verifyCorrectness(n: number): boolean {
  const base = runBaseline(n);
  const opt = runOptimized(n);
  return base.innerHTML === opt.innerHTML;
}
