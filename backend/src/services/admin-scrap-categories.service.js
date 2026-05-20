'use strict';

const { withTenant } = require('../prisma/client');

async function list(tenant) {
  return withTenant(tenant, (tx) =>
    tx.$queryRawUnsafe(
      `SELECT id, name FROM types WHERE entity = 'Scrap reason' AND is_active = 'Y' AND deleted_at IS NULL ORDER BY name`
    )
  );
}

module.exports = { list };
