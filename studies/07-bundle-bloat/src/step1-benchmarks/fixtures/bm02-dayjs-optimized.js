// BM-02 Optimized: dayjs (~2KB gzipped)
import dayjs from 'dayjs';
export const format = (d) => dayjs(d).format('YYYY-MM-DD');
export const diff = (a, b) => dayjs(a).diff(dayjs(b), 'day');
