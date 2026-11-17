const UA = 'Mozilla/5.0 (compatible; DPDS-Market/1.0)';

async function getText(url, timeout = 12000) {
  const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json,text/html,*/*' }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`원천 자료 HTTP ${response.status}`);
  return response.text();
}
async function getJson(url, timeout) { return JSON.parse(await getText(url, timeout)); }
function send(res, body, status = 200) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  res.status(status).json(body);
}
function fail(res, error) { send(res, { success: false, message: error.message }, 502); }
async function yahoo(symbol, range = '2y') {
  let error;
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      const data = await getJson(`https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`);
      const result = data.chart?.result?.[0];
      if (!result) throw new Error(data.chart?.error?.description || '시세 없음');
      const closes = result.indicators?.quote?.[0]?.close || [];
      const rows = (result.timestamp || []).map((t, i) => ({ date: new Date(t * 1000).toISOString().slice(0, 10), raw: Number(closes[i]) })).filter(r => Number.isFinite(r.raw) && r.raw > 0);
      if (!rows.length) throw new Error('유효한 시세 없음');
      return rows;
    } catch (e) { error = e; }
  }
  throw error;
}
function monthly(rows) {
  const groups = new Map();
  for (const row of rows) {
    const ym = row.date.slice(0, 7);
    if (!/^20\d\d-\d\d$/.test(ym) || !Number.isFinite(row.raw) || row.raw <= 0) continue;
    const group = groups.get(ym) || { total: 0, count: 0 };
    group.total += row.raw; group.count++; groups.set(ym, group);
  }
  const values = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([ym, g]) => ({ ym: ym.replace('-', ''), raw: Math.round(g.total / g.count * 100) / 100 }));
  if (values.length < 7) throw new Error('월별 자료 7개월 미만');
  const recent = values.slice(-7);
  const base = recent[0].raw;
  return recent.map(v => ({ ...v, index: Math.round(v.raw / base * 1000) / 10 }));
}
module.exports = { getText, getJson, send, fail, yahoo, monthly };
