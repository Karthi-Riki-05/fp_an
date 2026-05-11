'use strict';

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

class BadRequestError extends HttpError {
  constructor(message = 'bad-request') { super(400, message); }
}

class UnauthorizedError extends HttpError {
  constructor(message = 'unauthorized') { super(401, message); }
}

class ForbiddenError extends HttpError {
  constructor(message = 'forbidden') { super(403, message); }
}

class NotFoundError extends HttpError {
  constructor(message = 'not-found') { super(404, message); }
}

class ConflictError extends HttpError {
  constructor(message = 'conflict') { super(409, message); }
}

module.exports = { HttpError, BadRequestError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError };
