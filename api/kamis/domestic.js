const { getText, monthly, send, fail } = require('../_market');

// 축산물품질평가원 공개 계란 XL 생산자가격 이력. KAMIS 인증키가 없는
// 배포에서 KAMIS 자료인 것처럼 표시하지 않는다.
function eggHistory(html) {
  const rows = [];
  for (const match of html.matchAll(/chartData\.push\(\{([\s\S]*?)\}\);/g)) {
    const date = match[1].match(/"Month"\s*:\s*"(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일"/);
    const value = match[1].match(/"big2"\s*:\s*['"]([\d,]+)['"]/);
    if (date && value) rows.push({ date: `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}`, raw: Number(value[1].replaceAll(',', '')) });
  }
  return rows;
}
function beefMonthly(html) {
  const at = html.indexOf('summary="도매시장별 경락가격 테이블"');
  if (at < 0) throw new Error('한우 전국 가격표 없음');
  const table = html.slice(at);
  const rows = [];
  for (const m of table.matchAll(/<tr>\s*<th class="bd-r min-date">(\d{2})년\s*(\d{1,2})월<\/th>([\s\S]*?)<\/tr>/g)) {
    const price = m[3].match(/<td class="bd-r" data-col="all">\s*([\d,]+)\s*<\/td>/);
    if (price) rows.push({ date: `20${m[1]}-${m[2].padStart(2, '0')}-01`, raw: Number(price[1].replaceAll(',', '')) });
  }
  return rows;
}
function porkMonthly(html) {
  const at = html.indexOf('summary="도매시장별 경락가격 테이블"');
  if (at < 0) throw new Error('돼지 전국 가격표 없음');
  const table = html.slice(at);
  const rows = [];
  for (const m of table.matchAll(/<tr>\s*<th class="bd-r min-date">\s*(\d{2})년\s*(\d{1,2})월\s*<\/th>([\s\S]*?)<\/tr>/g)) {
    const prices = [...m[3].matchAll(/<td>\s*([\d,]+)\s*<\/td>/g)];
    const price = prices.at(-1);
    if (price) rows.push({ date: `20${m[1]}-${m[2].padStart(2, '0')}-01`, raw: Number(price[1].replaceAll(',', '')) });
  }
  return rows;
}
function periodUrl(livestock, now = new Date()) {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 6, 1));
  const ym = d => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const url = new URL('https://www.ekapepia.com/v3/price/auction/period/auctionPrice/period.do');
  const pig = livestock === 'pork';
  for (const [k, v] of Object.entries({ searchType: 'month', searchStartDate: ym(start), searchEndDate: ym(month), startYYMM: ym(start), endYYMM: ym(month), searchCondition: pig ? 'n1101' : '0000', searchCondition1: pig ? '4' : '1', searchCondition2: pig ? 'T' : '3', ...(pig ? { searchCondition3: '2' } : {}), searchYn: 'Y' })) url.searchParams.set(k, v);
  return url.toString();
}
module.exports = async function handler(req, res) {
  try {
    const [beefResult, porkResult, eggResult] = await Promise.allSettled([
      getText(periodUrl('beef')).then(html => monthly(beefMonthly(html))),
      getText(periodUrl('pork')).then(html => monthly(porkMonthly(html))),
      getText('https://www.ekapepia.com/v3/price/livestock/egg/producer/nation.do')
        .then(html => monthly(eggHistory(html), true))
    ]);
    const value = result => result.status === 'fulfilled' ? result.value : [];
    const beef = value(beefResult), pork = value(porkResult), egg = value(eggResult);
    if (!beef.length && !pork.length && !egg.length) throw new Error('국내 축산물 원천 자료 연결 실패');
    send(res, { success: true, beef, pork, egg, fish: [], source: '축산물품질평가원 한우 경락·돼지 탕박 전국(제주 제외) 경락·계란 XL 생산자가격', unavailable: [...(beef.length ? [] : ['한우']), ...(pork.length ? [] : ['돼지']), ...(egg.length ? [] : ['계란']), '광어'], updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
module.exports.eggHistory = eggHistory;
module.exports.beefMonthly = beefMonthly;
module.exports.porkMonthly = porkMonthly;
module.exports.periodUrl = periodUrl;
