'use strict';

require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const { authMiddleware } = require('./middleware/auth');
const { rateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const healthRoutes = require('./routes/health.routes');
const meRoutes = require('./routes/me.routes');
const tenantsRoutes = require('./routes/tenants.routes');
const rolesRoutes = require('./routes/roles.routes');
const equipmentRoutes = require('./routes/equipment.routes');
const adminTypesRoutes = require('./routes/admin-types.routes');
const adminUsersRoutes = require('./routes/admin-users.routes');
const adminStopReasonsRoutes = require('./routes/admin-stop-reasons.routes');
const adminScrapReasonsRoutes = require('./routes/admin-scrap-reasons.routes');
const adminStopCategoriesRoutes = require('./routes/admin-stop-categories.routes');
const adminScrapCategoriesRoutes = require('./routes/admin-scrap-categories.routes');
const adminPartsRoutes = require('./routes/admin-parts.routes');
const adminWorkShiftsRoutes = require('./routes/admin-work-shifts.routes');
const adminShiftSchedulesRoutes = require('./routes/admin-shift-schedules.routes');
const adminResultsRoutes = require('./routes/admin-results.routes');
const adminSalaryGroupsRoutes = require('./routes/admin-salary-groups.routes');
const adminFeedbackRoutes = require('./routes/admin-feedback.routes');
const adminBoardsRoutes = require('./routes/admin-boards.routes');
const cmsRoutes = require('./routes/cms.routes');
const slidersRoutes = require('./routes/sliders.routes');
const testimonialsRoutes = require('./routes/testimonials.routes');
const socialRoutes = require('./routes/social.routes');
const recentHistoryRoutes = require('./routes/recent-history.routes');
const superadminUsersRoutes = require('./routes/superadmin-users.routes');
const adminIotRoutes = require('./routes/admin-iot.routes');
const adminFlowDesignsRoutes = require('./routes/admin-flow-designs.routes');
const adminOrdersRoutes = require('./routes/admin-orders.routes');
const adminSymbolsRoutes = require('./routes/admin-symbols.routes');
const adminFoldersRoutes = require('./routes/admin-folders.routes');
const adminMachinesRoutes = require('./routes/admin-machines.routes');
const adminMachineFilesRoutes = require('./routes/admin-machine-files.routes');
const adminMachineProgrammesRoutes = require('./routes/admin-machine-programmes.routes');
const adminWorkstationsRoutes = require('./routes/admin-workstations.routes');

const app = express();

// Logging
if (process.env.NODE_ENV !== 'test') {
  const pino = require('pino');
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
  app.use(pinoHttp({ logger }));
}

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3030,http://localhost:3000')
  .split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: origins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
}));

// Body parsing & cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

// Rate limiting (global)
app.use(rateLimiter);

// Swagger UI
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'FP Analyzer API', version: '0.1.0', description: 'Express.js backend for FP Analyzer.\n\nAuth: cookie-based JWT (POST /auth/login sets the access_token cookie). Bearer JWT also accepted.\n\nTenant routing: most domain endpoints use the tenantId claim from the JWT. Admins can override via X-Tenant-Id header.' },
    components: {
      securitySchemes: {
        access_token: { type: 'apiKey', in: 'cookie', name: 'access_token' },
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'X-Tenant-Id': { type: 'apiKey', in: 'header', name: 'X-Tenant-Id' },
      },
    },
    servers: [{ url: '/', description: 'this server' }],
  },
  apis: ['./src/routes/*.js'],
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true, withCredentials: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  customSiteTitle: 'FP Analyzer API',
}));

// Static file serving for uploaded files
const path = require('path');
const localDir = path.resolve(process.env.STORAGE_LOCAL_DIR || 'storage/uploads');
app.use('/uploads', express.static(localDir));

// Public routes — no auth required
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);

// Apply JWT auth middleware for all subsequent routes
app.use(authMiddleware);

// Protected routes
app.use('/api/v1/me', meRoutes);
app.use('/api/v1/admin/tenants', tenantsRoutes);
app.use('/api/v1/admin/roles', rolesRoutes);
app.use('/api/v1/equipment', equipmentRoutes);
app.use('/api/v1/admin/types', adminTypesRoutes);
app.use('/api/v1/admin/users', adminUsersRoutes);
app.use('/api/v1/admin/stop-reasons', adminStopReasonsRoutes);
app.use('/api/v1/admin/scrap-reasons', adminScrapReasonsRoutes);
app.use('/api/v1/admin/stop-categories', adminStopCategoriesRoutes);
app.use('/api/v1/admin/scrap-categories', adminScrapCategoriesRoutes);
app.use('/api/v1/admin/parts', adminPartsRoutes);
app.use('/api/v1/admin/work-shifts', adminWorkShiftsRoutes);
app.use('/api/v1/admin/shift-schedules', adminShiftSchedulesRoutes);
app.use('/api/v1/admin/results', adminResultsRoutes);
app.use('/api/v1/admin/salary-groups', adminSalaryGroupsRoutes);
app.use('/api/v1/admin/feedback', adminFeedbackRoutes);
app.use('/api/v1/admin/boards', adminBoardsRoutes);
app.use('/api/v1/admin/cms', cmsRoutes);
app.use('/api/v1/admin/sliders', slidersRoutes);
app.use('/api/v1/admin/testimonials', testimonialsRoutes);
app.use('/api/v1/admin/social', socialRoutes);
app.use('/api/v1/admin/history', recentHistoryRoutes);
app.use('/api/v1/superadmin', superadminUsersRoutes);
app.use('/api/v1/admin/iot', adminIotRoutes);
app.use('/api/v1/admin/flow-designs', adminFlowDesignsRoutes);
app.use('/api/v1/admin/orders', adminOrdersRoutes);
app.use('/api/v1/admin/symbols', adminSymbolsRoutes);
app.use('/api/v1/admin/folders', adminFoldersRoutes);
app.use('/api/v1/admin/machines', adminMachinesRoutes);
app.use('/api/v1/admin/machine-files', adminMachineFilesRoutes);
app.use('/api/v1/admin/machine-programmes', adminMachineProgrammesRoutes);
app.use('/api/v1/admin/workstations', adminWorkstationsRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ statusCode: 404, message: 'not-found' });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
