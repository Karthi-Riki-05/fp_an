'use strict';

function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(403).json({ statusCode: 403, message: 'not-authenticated' });
    const hasRole = roles.some((r) => user.roles.includes(r));
    if (!hasRole) return res.status(403).json({ statusCode: 403, message: 'role-required' });
    next();
  };
}

module.exports = { requireRole };
