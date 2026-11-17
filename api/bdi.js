const { getJson, monthly, send, fail } = require('./_market');
module.exports = async function handler(req, res) {
  try {
    const raw = await getJson('https://www.balticdryindex.com/data/history.json');
    const rows = (Array.isArray(raw) ? raw : raw.series || []).map(r => ({ date: String(r.date || r.d || '').slice(0, 10), raw: Number(r.bdi ?? r.value ?? r.close ?? r.c) }));
    const series = monthly(rows);
    send(res, { success: true, series, source: 'BalticDryIndex.com 공개 이력 재제공', updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
