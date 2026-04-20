/**
 * logger.js  Ultimate CAD – Application Logger
 * Structured logger with level filtering, colorized output, and an
 * Express request-logger middleware.  Zero external dependencies.
 *
 * Log level is controlled by the LOG_LEVEL env variable:
 *   error | warn | info | http | debug   (default: info)
 */

const LEVELS = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

const COLORS = {
  error : '\x1b[31m',  // red
  warn  : '\x1b[33m',  // yellow
  info  : '\x1b[36m',  // cyan
  http  : '\x1b[35m',  // magenta
  debug : '\x1b[37m',  // white
  reset : '\x1b[0m',
};

const currentLevel = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

function log(level, message, meta = {}) {
  if (LEVELS[level] > currentLevel) return;

  const color = COLORS[level] ?? '';
  const reset = COLORS.reset;
  const label = level.toUpperCase().padEnd(5);
  const ts    = timestamp();

  const metaStr = Object.keys(meta).length
    ? ' ' + JSON.stringify(meta)
    : '';

  const line = `${color}[${ts}] [${label}]${reset} ${message}${metaStr}`;

  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  error : (msg, meta) => log('error', msg, meta ?? {}),
  warn  : (msg, meta) => log('warn',  msg, meta ?? {}),
  info  : (msg, meta) => log('info',  msg, meta ?? {}),
  http  : (msg, meta) => log('http',  msg, meta ?? {}),
  debug : (msg, meta) => log('debug', msg, meta ?? {}),
};

/**
 * Express HTTP request logger middleware.
 * Usage: app.use(requestLogger)
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms     = Date.now() - start;
    const status = res.statusCode;
    const method = req.method.padEnd(7);
    const url    = req.originalUrl;

    const statusColor = status >= 500 ? COLORS.error
                      : status >= 400 ? COLORS.warn
                      : status >= 300 ? COLORS.debug
                      : COLORS.info;

    log('http', `${statusColor}${status}${COLORS.reset} ${method} ${url} ${ms}ms`);
  });

  next();
}