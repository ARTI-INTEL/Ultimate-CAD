import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';

import { logger, requestLogger } from './utility/logger.js';

import authRoutes         from './routes/auth.routes.js';
import robloxRoutes       from './jobs/robloxManager.js';
import userRoutes         from './routes/users.routes.js';
import serverRoutes       from './routes/servers.routes.js';
import unitRoutes         from './routes/units.routes.js';
import callRoutes         from './routes/calls.routes.js';
import boloRoutes         from './routes/bolos.routes.js';
import reportRoutes       from './routes/reports.routes.js';
import searchRoutes       from './routes/search.routes.js';
import characterRoutes    from './routes/characters.routes.js';
import vehicleRoutes      from './routes/vehicles.routes.js';
import firearmRoutes      from './routes/firearms.routes.js';
import verificationRoutes from './routes/verification.routes.js';
import erlcRoutes         from './jobs/erlcPoller.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── CORS ────────────────────────────────────────────────────────────── */
// Set ALLOWED_ORIGINS in .env as a comma-separated list of allowed origins.
// Leave it unset in development to permit all origins.
//
// Example:
//   ALLOWED_ORIGINS=https://cad.yourdomain.com,https://www.yourdomain.com

const rawOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map(o => o.trim()).filter(Boolean)
  : null;

function originHandler(origin, callback) {
  // Requests with no Origin header (same-origin, Postman, mobile) are allowed.
  if (!origin) return callback(null, true);

  if (!allowedOrigins || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  logger.warn('CORS: rejected request from disallowed origin', { origin });
  callback(new Error('Not allowed by CORS'));
}

const corsOptions = {
  origin             : allowedOrigins ? originHandler : '*',
  methods            : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders     : ['Content-Type', 'x-user-id', 'Authorization'],
  credentials        : true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle pre-flight for all routes

/* ── Core middleware ─────────────────────────────────────────────────── */
app.use(requestLogger);
app.use(express.json());
app.use(express.static('public'));

/* ── Routes ──────────────────────────────────────────────────────────── */
app.use('/auth',         authRoutes);
app.use('/auth/roblox',  robloxRoutes);
app.use('/users',        userRoutes);
app.use('/servers',      serverRoutes);
app.use('/units',        unitRoutes);
app.use('/calls',        callRoutes);
app.use('/bolos',        boloRoutes);
app.use('/reports',      reportRoutes);
app.use('/search',       searchRoutes);
app.use('/characters',   characterRoutes);
app.use('/vehicles',     vehicleRoutes);
app.use('/firearms',     firearmRoutes);
app.use('/verification', verificationRoutes);
app.use('/erlc',         erlcRoutes);

/* ── Global error handler ────────────────────────────────────────────── */
// Catches any error passed to next(err) and errors thrown from async middleware.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  logger.error(err.message, {
    status,
    url   : req.originalUrl,
    method: req.method,
    stack : process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
  res.status(status).json({ error: err.message || 'Internal server error' });
});

/* ── Start ───────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  logger.info(`Ultimate CAD server running on http://localhost:${PORT}`);
  if (!allowedOrigins) {
    logger.warn('CORS is open to all origins. Set ALLOWED_ORIGINS in .env for production.');
  } else {
    logger.info('CORS allowed origins', { origins: allowedOrigins });
  }
});