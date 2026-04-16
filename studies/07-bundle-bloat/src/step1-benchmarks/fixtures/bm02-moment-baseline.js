// BM-02 Baseline: moment.js full import (non-tree-shakeable, ~67KB gzipped)
import moment from 'moment';
export const format = (d) => moment(d).format('YYYY-MM-DD');
export const diff = (a, b) => moment(a).diff(moment(b), 'days');
