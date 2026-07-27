'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const authRoutes = require('./modules/auth/auth.routes');
const progressRoutes = require('./modules/progress/progress.routes');
const adminRoutes = require('./modules/admin/admin.routes');

function createApp() {
  const app = express();

  app.set('trust proxy', 1); // работаем за nginx на VPS

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Разрешаем запросы без Origin (curl, health-check) и из белого списка.
        if (!origin || env.CORS_ORIGIN.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
  app.use('/api', apiLimiter);

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'saran-backend', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
