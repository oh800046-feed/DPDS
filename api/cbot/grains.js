const { yahoo, monthly, send, fail } = require('../_market');
module.exports = async function handler(req, res) {
  try {
    const [corn, soymeal] = await Promise.all([yahoo('ZC=F').then(monthly), yahoo('ZM=F').then(monthly)]);
    send(res, { success: true, corn, soymeal, corn_forward: [], soymeal_forward: [], source: 'Yahoo Finance 경유 CBOT 연속선물 일별 종가의 월평균', updated_at: new Date().toISOString() });
  } catch (e) { fail(res, e); }
};
