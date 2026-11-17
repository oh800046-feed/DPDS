const { getJson, send, fail } = require('../_market');
const endpoint = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json';
async function positions(code) {
  const query = new URL(endpoint);
  query.searchParams.set('$where', `cftc_contract_market_code='${code}'`);
  query.searchParams.set('$order', 'report_date_as_yyyy_mm_dd DESC');
  query.searchParams.set('$limit', '12');
  const raw = await getJson(query.toString());
  const rows = raw.map(r => {
    const date = String(r.report_date_as_yyyy_mm_dd || '').slice(0, 10);
    const long = Number(r.m_money_positions_long_all), short = Number(r.m_money_positions_short_all);
    if (!/^20\d\d-\d\d-\d\d$/.test(date) || !Number.isSafeInteger(long) || !Number.isSafeInteger(short) || long < 0 || short < 0) throw new Error('CFTC 자료 형식 확인 필요');
    return { date, long, short, net_long: long - short };
  });
  if (rows.length < 4) throw new Error('CFTC 자료 4주 미만');
  return rows.reverse();
}
module.exports = async function handler(req, res) {
  try {
    const [corn, soymeal] = await Promise.all([positions('002602'), positions('026603')]);
    send(res, { success: true, corn, soymeal, source: 'CFTC Disaggregated Futures Only · Managed Money', updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
