const { yahoo, monthly, send, fail } = require('../_market');
module.exports = async function handler(req, res) {
  try {
    const series = monthly(await yahoo('KRW=X'));
    send(res, { success: true, series, source: 'Yahoo Finance 경유 USD/KRW 일별 종가의 월평균 (ECOS 아님)', updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
