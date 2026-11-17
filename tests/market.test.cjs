const assert = require('node:assert/strict');
const { monthly } = require('../api/_market');
const { eggHistory } = require('../api/kamis/domestic');

const days = Array.from({length: 8}, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-15`, raw: (i + 1) * 10 }));
const points = monthly(days);
assert.equal(points.length, 7);
assert.equal(points[0].ym, '202602');
assert.equal(points[0].index, 100);
assert.equal(points.at(-1).index, 400);
const sparse = monthly([{ date: '2026-10-20', raw: 5000 }, { date: '2026-11-16', raw: 4500 }], true);
assert.equal(sparse.length, 7);
assert.deepEqual(sparse.slice(0, 5).map(p => p.index), [null, null, null, null, null]);
assert.deepEqual(sparse.slice(-2).map(p => p.index), [100, 90]);
assert.deepEqual(eggHistory('chartData.push({"Month":"2026년 10월 3일","big2":"7,230"});'), [{ date: '2026-10-03', raw: 7230 }]);
