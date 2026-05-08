import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser(process.env.COOKIE_SECRET));

  // CORS — frontend at :3030 calls backend at :4000 with credentials.
  // Origins comma-separated in CORS_ORIGINS, default localhost:3030.
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3030,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // OpenAPI / Swagger UI mounted at /api/docs (outside the api/v1 prefix).
  // The login endpoint sets an httpOnly cookie, and Swagger UI's
  // `withCredentials` flag below makes the browser send it on subsequent
  // "Try it out" calls — so once you POST /auth/login, every other endpoint
  // is authenticated automatically.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FP Analyzer API')
    .setDescription(
      'NestJS backend for FP Analyzer.\n\n' +
        'Auth: cookie-based JWT (POST /auth/login sets the access_token cookie). ' +
        'Bearer JWT also accepted via the Authorize button.\n\n' +
        'Tenant routing: most domain endpoints use the `tenantId` claim from ' +
        'the JWT. Admins can override via `X-Tenant-Id` header.',
    )
    .setVersion('0.1.0')
    .addCookieAuth('access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'access_token',
    })
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Tenant-Id' }, 'X-Tenant-Id')
    .addServer('/', 'this server')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true, // sends cookies on Try-it-out
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'FP Analyzer API',
  });

  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  const log = app.get(Logger);
  log.log(`Backend listening on http://0.0.0.0:${port}/api/v1`);
  log.log(`Swagger UI:           http://0.0.0.0:${port}/api/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
