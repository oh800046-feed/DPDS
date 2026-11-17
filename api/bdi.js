const { getJson, monthly, send, fail } = require('./_market');
module.exports = async function handler(req, res) {
  try {
    const raw = await getJson('https://www.balticdryindex.com/data/history.json');
    const rows = (Array.isArray(raw) ? raw : raw.series || []).map(r => ({ date: String(r.date || r.d || '').slice(0, 10), raw: Number(r.bdi ?? r.value ?? r.close ?? r.c) }));
    if (req.query?.debug === '1') return send(res, { count: rows.length, first: rows.slice(0, 2), last: rows.slice(-2), keys: Object.keys((Array.isArray(raw) ? raw : raw.series || [])[0] || {}) });
    const series = monthly(rows);
    send(res, { success: true, series, source: 'BalticDryIndex.com 공개 이력 재제공', updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
