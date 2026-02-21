// The optimized variant is identical to baseline — same query, same table.
// The only difference is the presence of the index, managed by the runner.
// This file re-exports bm01 for use as the optimized module reference.
export { bm01 } from './baseline';
