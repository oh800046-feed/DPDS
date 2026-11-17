const assert = require('node:assert/strict');
const { monthly } = require('../api/_market');
const { eggHistory, beefMonthly, porkMonthly, periodUrl } = require('../api/kamis/domestic');

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
assert.deepEqual(beefMonthly('<table summary="도매시장별 경락가격 테이블"><tr><th class="bd-r min-date">26년 11월</th><td data-col="quality-grade">26,139</td><td class="bd-r" data-col="all">24,255</td></tr>'), [{ date: '2026-11-01', raw: 24255 }]);
assert.deepEqual(porkMonthly('<table summary="도매시장별 경락가격 테이블"><tr><th class="bd-r min-date">26년 11월</th><td>5,309</td><td>5,569</td><td class="bg-blue">291</td></tr>'), [{ date: '2026-11-01', raw: 5569 }]);
assert.equal(new URL(periodUrl('pork', new Date('2026-11-17'))).searchParams.get('searchCondition1'), '4');
