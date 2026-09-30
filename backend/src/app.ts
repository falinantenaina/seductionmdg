import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env, isProd } from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/users/users.routes.js';
import categoryRoutes from './modules/categories/category.routes.js';
import articleRoutes from './modules/articles/article.routes.js';
import stockRoutes from './modules/stocks/stock.routes.js';
import customerRoutes from './modules/customers/customer.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import invoiceRoutes from './modules/invoices/invoice.routes.js';
import warehouseRoutes from './modules/warehouse/warehouse.routes.js';
import deliveryRoutes from './modules/deliveries/delivery.routes.js';
import deliveryPersonRoutes from './modules/delivery-persons/person.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Aucune mise en cache des réponses de l'API (données commerciales sensibles).
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: isProd ? 600 : 5000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Trop de requêtes, réessayez plus tard', code: 'RATE_LIMIT' },
    }),
  );

  // Limite stricte contre le force brute sur l'ouverture de session.
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: env.NODE_ENV === 'test' ? 10_000 : isProd ? 10 : 200,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Trop de tentatives de connexion, réessayez dans 15 minutes',
        code: 'RATE_LIMIT',
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', env: env.NODE_ENV } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/articles', articleRoutes);
  app.use('/api/stocks', stockRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/warehouse', warehouseRoutes);
  app.use('/api/deliveries', deliveryRoutes);
  app.use('/api/delivery-persons', deliveryPersonRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/audit', auditRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
