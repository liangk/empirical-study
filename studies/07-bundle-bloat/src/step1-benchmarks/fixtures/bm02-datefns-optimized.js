// BM-02 Optimized: date-fns named imports (tree-shakeable)
import { format, differenceInDays } from 'date-fns';
export const fmt = (d) => format(d, 'yyyy-MM-dd');
export const diff = (a, b) => differenceInDays(new Date(a), new Date(b));
