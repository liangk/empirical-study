// BM-01 Optimized: named imports from lodash-es (tree-shakeable)
import { debounce, throttle } from 'lodash-es';
export const debounced = debounce(() => {}, 300);
export const throttled = throttle(() => {}, 300);
