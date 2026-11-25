// node --test tests/platform.test.cjs — v48 '실행계획 Platform' 파일(BD·비연동 Spread 시트) 변환 점검 (합성 자료)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const a = html.indexOf("<script>/* === xlsx.full.min.js === */") + 8;
const ctx = { console, TextDecoder, TextDecoderStream, DecompressionStream, Blob }; ctx.window = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(html.slice(a, html.indexOf("</script>", a)), ctx);
function extract(name) {
  let i = html.indexOf(`function ${name}(`);
  if (html.slice(i - 6, i) === "async ") i -= 6;
  let d = 0, k = html.indexOf("{", html.indexOf(")", i));
  for (; k < html.length; k++) { if (html[k] === "{") d++; else if (html[k] === "}" && --d === 0) break; }
  return html.slice(i, k + 1);
}
const xu = html.slice(html.indexOf("const _xmlUnescape"), html.indexOf("\n", html.indexOf("const _xmlUnescape")));
vm.runInContext(xu.replace("const ", "var ") + "\n" + ["_zipFindEntry", "_zipEntryChunks", "_zipEntryText", "_colIndex", "_readPlatformPnlQty"].map(extract).join("\n"), ctx);
vm.runInContext(["_normalizeCell", "_toNum", "_detectMonthColumns", "_isPlatformSheetSet", "_platformMetricKey",
  "_platformLinkedShare", "_platformExecPriceAdj", "_parsePlatformWorkbook"].map(extract).join("\n"), ctx);
const { XLSX } = ctx;

const months = (v) => Array(12).fill(v);
function book() {
  // BD: 1~10월 실적, 11~12월 실행계획, 사업계획 1~12월 (톤·백만원)
  const grp = ["", "", "", ...Array(10).fill("26년 실적"), "26년 실행계획", "", "26년 사업계획", ...Array(11).fill(""), "25년 실적"];
  const head = ["", "축종", "손익항목", ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), "1월"];
  const row = (code, act, exe, pln) => ["전체", "양돈", code, ...months(act).slice(0, 10), exe, exe, ...months(pln), 999];
  const bd = [grp, head,
    row("02.매출중량", 10, 12, 11), row("01.매출", 7, 7, 7), row("02.매출할인", -1, -1, -1), row("순매출액", 6, 6, 6),
    row("01.재료비_원재료비", 4, 4, 4), row("12.(판매)물류비_운반비_변동", 1, 1, 1), row("16.(관리)지급수수료_고정", 0.5, 0.5, 0.5),
    row("영업이익", 0.5, 0.5, 0.5), row("공헌이익", 9, 9, 9)];
  const sp = [["수익성\n손익항목", "대분류\n코드", "대분류명", "계정구분", "연동제", "'26년 실적"],
    ["", "", "", "", "", ...Array.from({ length: 12 }, (_, i) => `'26.${String(i + 1).padStart(2, "0")}`)],
    ["02.매출중량", 2, "양돈", "제품", "연동", ...months(3).slice(0, 10)],
    ["02.매출중량", 2, "양돈", "제품", "비연동", ...months(7).slice(0, 10)]];
  const adj = [["대분류", "중분류", ...Array.from({ length: 12 }, (_, i) => `26.${String(i + 1).padStart(2, "0")}`)],
    ["양돈", "양돈", null, null, null, null, null, null, null, 0, 0, 0, 8, 0]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bd), "BD");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sp), "비연동 Spread");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(adj), "판가조정");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), "경영실적 보고");
  return wb;
}
const sum = (rows, key, linked) => rows.filter(r => r.metricKey === key && (!linked || r.linked === linked))
  .reduce((s, r) => s + r.total, 0);

test("BD 시트: 실적 열 수로 마감월, 실행계획은 잔여월, 단위 kg·원", () => {
  const wb = book();
  assert.ok(ctx._isPlatformSheetSet(wb.SheetNames));
  const P = ctx._parsePlatformWorkbook(wb);
  assert.equal(P.cm, 10);
  assert.deepEqual([...P.execMonths], [11, 12]);
  assert.equal(sum(P.rows.actual, "qty"), 10 * 10 * 1000);            // 11·12월 실적 없음
  assert.equal(sum(P.rows.exec, "qty"), (10 * 10 + 2 * 12) * 1000);
  assert.equal(sum(P.rows.plan, "rev"), 12 * 6 * 1e6);                 // 총매출·할인은 빼고 순매출액만
  assert.equal(sum(P.rows.plan, "salesVar"), 12 * 1e6);
  assert.equal(sum(P.rows.plan, "ga"), 12 * 0.5e6);
  assert.ok(!P.rows.plan.some(r => r.metric === "공헌이익"));
});

test("연동/비연동은 비연동 Spread 물량 비중(실적 없는 달은 누계 비중)", () => {
  const P = ctx._parsePlatformWorkbook(book());
  assert.ok(Math.abs(sum(P.rows.exec, "qty", "비연동") - (10 * 10 + 2 * 12) * 1000 * 0.7) < 1e-6);
  assert.deepEqual(JSON.parse(JSON.stringify(P.execPriceAdj)), { 양돈: { 11: 8 } });
});

test("실행계획에 들어 있던 판가 조정은 잔여월 비연동 물량만큼 빼서 '인상 전' 전망으로", () => {
  const P = ctx._parsePlatformWorkbook(book());
  const won = 8 * 12 * 1000 * 0.7;                                    // 11월 +8원 × 비연동 물량(12톤의 70%), 12월까지 누적
  assert.ok(Math.abs(P.execPriceAdjRemovedWon - 2 * won) < 1e-6);
  assert.ok(Math.abs(sum(P.rows.exec, "op") - (12 * 0.5e6 - 2 * won)) < 1e-6);
  assert.ok(Math.abs(sum(P.rows.exec, "rev") - (12 * 6e6 - 2 * won)) < 1e-6);
  assert.equal(sum(P.rows.actual, "op"), 10 * 0.5e6);                 // 실적월은 그대로
});

test("P&L 시트 판매량을 zip 스트리밍으로 읽어 잔여월 연동 비중에 쓴다", async () => {
  const pl = [["", "구분", "", "대분류", "연동제", "구분1_고정", ...Array.from({ length: 12 }, (_, i) => `26.${String(i + 1).padStart(2, "0")}`), "27.01", "26.01"],
    ["", 1, "", "양돈", "연동", "판매량", ...months(1000), 9, 9],
    ["", 2, "", "양돈", "비연동", "판매량", ...months(9000), 9, 9],
    ["", 3, "", "양돈", "비연동", "순매출액", ...months(777), 9, 9]];
  for (const compression of [false, true]) {
    const wb = book();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pl), "P&L");
    const u8 = new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression }));
    const q = await ctx._readPlatformPnlQty(u8);
    assert.equal(q.양돈.L[10], 1000);
    assert.equal(q.양돈.N[10], 9000);                                   // 순매출액 행·27년 열은 제외
    wb.__pnlQty = q;
    const P = ctx._parsePlatformWorkbook(wb);
    assert.deepEqual([...P.pnlShareMonths], [11, 12]);
    const nl = P.rows.exec.find(r => r.metricKey === "qty" && r.linked === "비연동");
    assert.ok(Math.abs(nl.months[10] - 12 * 1000 * 0.9) < 1e-6);        // 11월: P&L 비중 90%
    assert.ok(Math.abs(nl.months[0] - 10 * 1000 * 0.7) < 1e-6);         // 실적월: 비연동 Spread 비중 70%
  }
});
