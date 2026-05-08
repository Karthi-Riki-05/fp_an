import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

// Stub. Phase 3 expands this to translate Prisma errors to HTTP codes
// and emit consistent { error: { code, message, details } } payloads.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';
    response.status(status).json({
      error: {
        code: status,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
