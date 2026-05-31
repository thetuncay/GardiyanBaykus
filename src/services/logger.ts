import type { Env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";

const order: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let minLevel: Level = "info";

export function configureLoggerFromEnv(env: Env): void {
  minLevel = env.LOG_LEVEL;
}

function shouldLog(level: Level): boolean {
  return order[level] >= order[minLevel];
}

function format(
  scope: string,
  level: Level,
  message: string,
  meta?: Record<string, unknown>,
): string {
  const ts = new Date().toISOString();
  const extra = meta ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] [${level.toUpperCase()}] [${scope}] ${message}${extra}`;
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      if (shouldLog("debug")) console.debug(format(scope, "debug", message, meta));
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      if (shouldLog("info")) console.info(format(scope, "info", message, meta));
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      if (shouldLog("warn")) console.warn(format(scope, "warn", message, meta));
    },
    error: (message: string, meta?: Record<string, unknown>) => {
      if (shouldLog("error")) console.error(format(scope, "error", message, meta));
    },
  };
}
