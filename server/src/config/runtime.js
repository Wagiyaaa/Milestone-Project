const path = require("path");

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSameSite(value, fallback = "lax") {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (["lax", "strict", "none"].includes(normalized)) {
    return normalized;
  }

  return fallback;
}

function normalizeLogDestination(value, fallback) {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (["file", "stdout", "both"].includes(normalized)) {
    return normalized;
  }

  return fallback;
}

const isProduction = process.env.NODE_ENV === "production";
const debugErrors = parseBoolean(process.env.DEBUG_ERRORS, !isProduction);
const port = Number(process.env.PORT) || 5000;
const httpsEnabled = parseBoolean(process.env.HTTPS_ENABLED, false);
const httpsPort = Number(process.env.HTTPS_PORT) || port;
const httpsCertDir = process.env.HTTPS_CERT_DIR || path.resolve(__dirname, "..", "..", "certs");
const httpsKeyPath = process.env.HTTPS_KEY_PATH || path.join(httpsCertDir, "selfsigned.key");
const httpsCertPath = process.env.HTTPS_CERT_PATH || path.join(httpsCertDir, "selfsigned.crt");
const httpsCommonName = process.env.HTTPS_COMMON_NAME || "localhost";
const httpsCertDaysValid = Number(process.env.HTTPS_CERT_DAYS_VALID) || 30;
const uploadMaxMb = Number(process.env.UPLOAD_MAX_MB) || 5;
const sessionIdleMinutes = Number(process.env.SESSION_IDLE_MINS) || 15;
const sessionAbsoluteHours =
  Number(process.env.SESSION_ABSOLUTE_HOURS) || Number(process.env.SESSION_ABS_HRS) || 8;

const configuredCorsOrigins = parseList(process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN);
const defaultDevCorsOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const corsAllowedOrigins =
  configuredCorsOrigins.length > 0
    ? configuredCorsOrigins
    : isProduction
      ? []
      : defaultDevCorsOrigins;

const sessionCookieSameSite = normalizeSameSite(process.env.SESSION_COOKIE_SAMESITE, "lax");
const requestedSessionCookieSecure = parseBoolean(process.env.SESSION_COOKIE_SECURE, isProduction);
const forcedSecureCookie = sessionCookieSameSite === "none" && !requestedSessionCookieSecure;
const sessionCookieSecure = sessionCookieSameSite === "none"
  ? true
  : requestedSessionCookieSecure;

const uploadsBaseDir = process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "..", "uploads");
const logFilePath = process.env.LOG_FILE_PATH || path.resolve(__dirname, "..", "..", "logs", "app.log");
const logDestination = normalizeLogDestination(
  process.env.LOG_DESTINATION,
  isProduction ? "stdout" : "file"
);

const autoApplySchema = parseBoolean(process.env.AUTO_APPLY_SCHEMA, false);
const autoBootstrapAdmin = parseBoolean(process.env.AUTO_BOOTSTRAP_ADMIN, false);

const sessionCookieOptions = {
  httpOnly: true,
  sameSite: sessionCookieSameSite,
  secure: sessionCookieSecure,
  maxAge: sessionAbsoluteHours * 60 * 60 * 1000,
};

const clearSessionCookieOptions = {
  httpOnly: true,
  sameSite: sessionCookieSameSite,
  secure: sessionCookieSecure,
};

function getCorsOptions() {
  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (corsAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
  };
}

function getStartupWarnings() {
  const warnings = [];

  if (isProduction && corsAllowedOrigins.length === 0) {
    warnings.push(
      "CORS is disabled in production. This is correct for a same-origin deploy where Express serves the built client."
    );
  }

  if (isProduction && httpsEnabled) {
    warnings.push("HTTPS_ENABLED is on. Render already terminates HTTPS, so leave this off in hosted production unless you need end-to-end TLS behind a custom proxy.");
  }

  if (isProduction && !process.env.UPLOAD_DIR) {
    warnings.push(
      "Uploads are using local disk storage. On Render this storage is ephemeral unless you mount a persistent disk."
    );
  }

  if (isProduction && (logDestination === "file" || logDestination === "both")) {
    warnings.push(
      "Audit logs are writing to local files. On Render those files are ephemeral unless you use a persistent disk."
    );
  }

  if (forcedSecureCookie) {
    warnings.push("SESSION_COOKIE_SAMESITE=none requires secure cookies. Secure cookies were forced on.");
  }

  if (autoBootstrapAdmin && !process.env.ADMIN_PASSWORD) {
    warnings.push("AUTO_BOOTSTRAP_ADMIN is enabled but ADMIN_PASSWORD is missing. Startup will fail.");
  }

  if (autoBootstrapAdmin && !autoApplySchema) {
    warnings.push("AUTO_BOOTSTRAP_ADMIN assumes the schema already exists. Enable AUTO_APPLY_SCHEMA on fresh deployments.");
  }

  return warnings;
}

function getStartupFatalErrors() {
  const errors = [];

  if (!process.env.SESSION_SECRET) {
    errors.push("SESSION_SECRET is required.");
  }

  return errors;
}

module.exports = {
  autoApplySchema,
  autoBootstrapAdmin,
  clearSessionCookieOptions,
  corsAllowedOrigins,
  debugErrors,
  getCorsOptions,
  getStartupFatalErrors,
  getStartupWarnings,
  httpsCertDaysValid,
  httpsCertPath,
  httpsCommonName,
  httpsEnabled,
  httpsKeyPath,
  httpsPort,
  isProduction,
  logDestination,
  logFilePath,
  port,
  sessionAbsoluteHours,
  sessionCookieOptions,
  sessionCookieSecure,
  sessionIdleMinutes,
  uploadMaxMb,
  uploadsBaseDir,
};
