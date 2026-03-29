// src/utils/logger.ts

// In a production system we should swap this for winston or pino,

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();

  if (process.env.NODE_ENV === 'production') {
    // Structured JSON — one line per log entry, easy to parse
    console[level === 'debug' ? 'log' : level](
      JSON.stringify({ timestamp, level, message, data: args.length ? args : undefined })
    );
  } else {
    // Human-readable in dev
    const colours: Record<LogLevel, string> = {
      info:  '\x1b[36m',   // cyan
      warn:  '\x1b[33m',   // yellow
      error: '\x1b[31m',   // red
      debug: '\x1b[90m',   // grey
    };
    const reset = '\x1b[0m';
    const prefix = `${colours[level]}[${level.toUpperCase()}]${reset} ${timestamp}`;
    console[level === 'debug' ? 'log' : level](prefix, message, ...args);
  }
}

export const logger = {
  info:  (msg: string, ...args: unknown[]) => log('info',  msg, ...args),
  warn:  (msg: string, ...args: unknown[]) => log('warn',  msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
};