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
module.exports = async function handler(req, res) {
  try {
    const html = await getText('https://www.ekapepia.com/v3/price/livestock/egg/producer/nation.do');
    const history = eggHistory(html);
    if (req.query?.debug === '1') return send(res, { count: history.length, first: history.slice(0, 2), last: history.slice(-2), htmlLength: html.length, chartCount: [...html.matchAll(/chartData\.push/g)].length });
    const egg = monthly(history);
    send(res, { success: true, beef: [], pork: [], egg, fish: [], source: '축산물품질평가원 계란 XL 생산자가격', unavailable: ['한우', '돼지', '광어'], updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
module.exports.eggHistory = eggHistory;
