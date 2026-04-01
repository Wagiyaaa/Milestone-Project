const fs = require("fs/promises");
const path = require("path");

const LOG_DIR = path.resolve(__dirname, "..", "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "app.log");
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 25;

function normalizeIp(ip) {
  if (typeof ip !== "string") return "";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  return ip;
}

function sanitizeString(value) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, MAX_STRING_LENGTH);
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return "[truncated]";

  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_OBJECT_KEYS)
        .map(([key, entryValue]) => [key, sanitizeValue(entryValue, depth + 1)])
    );
  }

  return String(value);
}

function buildRequestContext(req) {
  return {
    request_id: req?.id || null,
    method: req?.method || null,
    path: req?.originalUrl || req?.path || null,
    ip_address: normalizeIp(req?.ip),
    user_agent: req?.get?.("user-agent") || null,
  };
}

async function writeAuditLog(entry) {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });

    const payload = sanitizeValue({
      timestamp: new Date().toISOString(),
      ...entry,
    });

    await fs.appendFile(LOG_FILE, `${JSON.stringify(payload)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  } catch (err) {
    console.error("audit log write failed", err?.message || err);
  }
}

module.exports = { writeAuditLog, buildRequestContext };
