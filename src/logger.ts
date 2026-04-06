export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let configuredLevel: LogLevel = "info";

export function configureLogger(level: LogLevel) {
  configuredLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };
  if (error.stack) serialized.stack = error.stack;
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause !== undefined) serialized.cause = serializeError(cause);
  return serialized;
}

function normalizeFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!fields) return {};
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = key === "error" ? serializeError(value) : value;
  }
  return normalized;
}

function emit(level: LogLevel, scope: string, message: string, fields?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...normalizeFields(fields),
  };

  if (level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }

  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }

  console.log(JSON.stringify(entry));
}

export function createLogger(scope: string, baseFields?: Record<string, unknown>) {
  return {
    debug(message: string, fields?: Record<string, unknown>) {
      emit("debug", scope, message, { ...baseFields, ...fields });
    },
    info(message: string, fields?: Record<string, unknown>) {
      emit("info", scope, message, { ...baseFields, ...fields });
    },
    warn(message: string, fields?: Record<string, unknown>) {
      emit("warn", scope, message, { ...baseFields, ...fields });
    },
    error(message: string, fields?: Record<string, unknown>) {
      emit("error", scope, message, { ...baseFields, ...fields });
    },
  };
}
