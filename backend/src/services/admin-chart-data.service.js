'use strict';
const { withTenant } = require('../prisma/client');

async function getChartData(tenant, settings, from, to) {
  const { flow_id, equip_id, chart_type = 'stop_data', prod_group } = settings;
  const start = from || new Date().toISOString().slice(0, 10);
  const end = to || new Date().toISOString().slice(0, 10);

  return withTenant(tenant, async (tx) => {
    const baseWhere = `flow_id = $1 AND date BETWEEN $2 AND $3 AND deleted_at IS NULL`;
    const params = [flow_id ?? 0, start, end];

    if (chart_type === 'stop_data') {
      return tx.$queryRawUnsafe(
        `SELECT sr.id AS reason_id, sr.name, SUM(sd.quantity) AS quantity, SUM(sd.sum_of_time) AS sum_of_time
         FROM stop_data sd LEFT JOIN stop_reasons sr ON sr.id = sd.reason
         WHERE ${baseWhere} GROUP BY sr.id, sr.name ORDER BY quantity DESC`, ...params
      );
    } else if (chart_type === 'stop_count') {
      return tx.$queryRawUnsafe(
        `SELECT sd.date, sr.name, SUM(sd.quantity) AS quantity, SUM(sd.time) AS total_time
         FROM stop_data sd LEFT JOIN stop_reasons sr ON sr.id = sd.reason
         WHERE ${baseWhere} GROUP BY sd.date, sr.name ORDER BY sd.date DESC`, ...params
      );
    } else if (chart_type === 'scrap_data') {
      return tx.$queryRawUnsafe(
        `SELECT sr.id AS reason_id, sr.name, SUM(sd.quantity) AS quantity
         FROM scrap_data sd LEFT JOIN scrap_reasons sr ON sr.id = sd.reason
         WHERE ${baseWhere} GROUP BY sr.id, sr.name ORDER BY quantity DESC`, ...params
      );
    } else if (chart_type === 'production_data') {
      const groupCol = prod_group === 'part' ? 'p.part_no || \'-\' || p.name'
        : prod_group === 'equipment' ? 'e.name'
        : prod_group === 'work_shift' ? 'pd.work_shift_name'
        : 'pd.order_no';
      const joinClause = prod_group === 'part'
        ? 'LEFT JOIN parts p ON p.id = pd.part_id'
        : prod_group === 'equipment'
        ? 'LEFT JOIN equipment e ON e.id = pd.flow_object_key'
        : '';
      return tx.$queryRawUnsafe(
        `SELECT pd.date, ${groupCol} AS name, SUM(pd.part_qty) AS ok_qty, SUM(pd.planned_qty) AS planned_qty
         FROM production_data pd ${joinClause}
         WHERE ${baseWhere} GROUP BY pd.date, ${groupCol} ORDER BY pd.date DESC`, ...params
      );
    }
    return [];
  });
}

module.exports = { getChartData };
