'use strict';

const { Prisma } = require('@prisma/client');

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  // Known HTTP errors from our errors.js
  if (err.statusCode) {
    return res.status(err.statusCode).json({ statusCode: err.statusCode, message: err.message });
  }

  // Prisma unique constraint violation → 409
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ statusCode: 409, message: 'conflict' });
  }

  console.error(err);
  res.status(500).json({ statusCode: 500, message: 'internal-server-error' });
}

module.exports = { errorHandler };
