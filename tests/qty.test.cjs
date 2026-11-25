// node --test tests/qty.test.cjs — v46 물량 보정 함수 점검(index.html에서 함수만 뽑아 실행)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
function extract(name) {
  const i = html.indexOf(`function ${name}(`);
  let d = 0, k = html.indexOf("{", i);
  for (; k < html.length; k++) { if (html[k] === "{") d++; else if (html[k] === "}" && --d === 0) break; }
  return html.slice(i, k + 1);
}
const { _fillOpenQtyFromPlan, _applyCatQtyAdjust, _fillOpenCostsFromPlan } = new Function(
  ["const _COST_METRICS = ['rawMat', 'mfgVar', 'mfgFix', 'salesVar', 'salesFix', 'ga'];",
   extract("_fillOpenCostsFromPlan"), extract("_fillOpenQtyFromPlan"), extract("_applyCatQtyAdjust"), extract("_applyQtyFactors"),
   "return { _fillOpenQtyFromPlan, _applyCatQtyAdjust, _fillOpenCostsFromPlan };"].join("\n"))();

const m = (arr) => ({ months: arr.slice(), total: arr.reduce((s, v) => s + v, 0) });
const fill = (v, from = 0) => Array.from({ length: 12 }, (_, i) => (i >= from ? v : 0));

test("실행계획 판매량이 없으면 잔여월 물량 = 계획 물량 × 실행/계획 매출", () => {
  const outlook = { byMetric: { qty: m(fill(0)) }, byCategory: { 양돈: { qty: m([...fill(100).slice(0, 4), ...fill(0).slice(4)]), rev: m(fill(66000)) } } };
  const plan = { byCategory: { 양돈: { qty: m(fill(110)), rev: m(fill(60000)) } } };
  assert.deepEqual(_fillOpenQtyFromPlan(outlook, plan, 4), ["양돈"]);
  assert.equal(outlook.byCategory.양돈.qty.months[0], 100);          // 마감월은 그대로
  assert.ok(Math.abs(outlook.byCategory.양돈.qty.months[5] - 121) < 1e-9); // 110 × 66000/60000
  assert.ok(Math.abs(outlook.byMetric.qty.total - (400 + 8 * 121)) < 1e-6);
});

test("물량 조정은 잔여월에만, 공헌이익 증감만큼 영업이익이 바뀐다", () => {
  const cat = { qty: m(fill(100)), rev: m(fill(600)), rawMat: m(fill(450)), mfgVar: m(fill(20)), salesVar: m(fill(10)), op: m(fill(70)) };
  const outlook = { byMetric: { qty: m(fill(100)), op: m(fill(70)) }, byCategory: { 양돈: cat } };
  const f = _applyCatQtyAdjust(outlook, null, { 양돈: -80 }, 4);       // 잔여 8개월 800 중 -80 → -10%
  assert.ok(Math.abs(f.양돈 - 0.9) < 1e-12);
  assert.equal(cat.qty.months[0], 100);
  assert.ok(Math.abs(cat.qty.months[4] - 90) < 1e-9);
  assert.ok(Math.abs(cat.op.total - (12 * 70 - 8 * 12)) < 1e-9);    // kg당 공헌이익 1.2 × 10 × 8개월 감소
  assert.ok(Math.abs(outlook.byMetric.op.total - cat.op.total) < 1e-9);
});

test("원가 행이 없으면 마감월 공헌이익률로 물량 효과를 잡는다", () => {
  const rev = fill(600), raw = [...fill(450).slice(0, 4), ...fill(0).slice(4)];
  const cat = { qty: m(fill(100)), rev: m(rev), rawMat: m(raw), mfgVar: m(fill(0)), salesVar: m(fill(0)), op: m(fill(70)) };
  const outlook = { byMetric: { op: m(fill(70)) }, byCategory: { 양돈: cat } };
  _applyCatQtyAdjust(outlook, null, { 양돈: 80 }, 4);                   // +10%
  assert.ok(Math.abs(cat.op.total - (12 * 70 + 8 * 60 * 0.25)) < 1e-9); // 매출 +60 × 공헌이익률 25%
});

test("원가 행이 없는 잔여월: 원가 = 매출 − 영업이익, 사업계획 구성비로 배분", () => {
  const z = () => m(fill(0));
  const cat = { rev: m(fill(600)), op: m(fill(30)), rawMat: z(), mfgVar: z(), mfgFix: z(), salesVar: z(), salesFix: z(), ga: z(), gp: m(fill(600)), opCalc: m(fill(600)) };
  const outlook = { byMetric: {}, byCategory: { 양돈: cat } };
  const plan = { byCategory: { 양돈: { rawMat: m(fill(450)), mfgVar: m(fill(20)), mfgFix: m(fill(30)), salesVar: m(fill(10)), salesFix: m(fill(10)), ga: m(fill(10)) } } };
  assert.deepEqual(_fillOpenCostsFromPlan(outlook, plan, 4), ["양돈"]);
  assert.equal(cat.rawMat.months[0], 0);                                  // 마감월은 그대로
  assert.ok(Math.abs(cat.rawMat.months[5] - 570 * 450 / 530) < 1e-9);    // (600−30) × 450/530
  assert.ok(Math.abs(cat.gp.months[5] - (600 - 570 * 500 / 530)) < 1e-9);
  assert.equal(cat.opCalc.months[5], 30);
  assert.equal(cat.op.total, 12 * 30);                                     // 업로드 영업이익 유지
});
