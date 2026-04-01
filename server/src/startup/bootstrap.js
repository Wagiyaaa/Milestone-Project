const bcrypt = require("bcrypt");

const pool = require("../db");
const {
  autoApplySchema,
  autoBootstrapAdmin,
  getStartupWarnings,
} = require("../config/runtime");
const { defaultProfilePhotoDataUrl } = require("../utils/defaultProfilePhoto");
const { applySchema } = require("./schema");

async function ensureAdminUserFromEnv(client) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is required when AUTO_BOOTSTRAP_ADMIN is enabled.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await client.query(
    `
      INSERT INTO users (full_name, email, phone_e164, password_hash, role, profile_photo_path, is_active)
      VALUES ($1, $2, $3, $4, 'admin', $5, true)
      ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          phone_e164 = EXCLUDED.phone_e164,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          profile_photo_path = EXCLUDED.profile_photo_path,
          is_active = EXCLUDED.is_active
      RETURNING id, email, role
    `,
    [
      process.env.ADMIN_FULL_NAME || "Render Admin",
      process.env.ADMIN_EMAIL || "admin@example.com",
      process.env.ADMIN_PHONE_E164 || "+639111111111",
      passwordHash,
      defaultProfilePhotoDataUrl(process.env.ADMIN_FULL_NAME || "Render Admin"),
    ]
  );

  return result.rows[0];
}

async function applySchemaOnStartup() {
  const client = await pool.connect();
  try {
    await applySchema(client);
    console.log("[startup] Database schema applied.");
  } finally {
    client.release();
  }
}

async function bootstrapAdminOnStartup() {
  const client = await pool.connect();
  try {
    const admin = await ensureAdminUserFromEnv(client);
    console.log(`[startup] Admin ready: ${admin.email} (${admin.role})`);
  } finally {
    client.release();
  }
}

async function runStartupTasks() {
  for (const warning of getStartupWarnings()) {
    console.warn(`[startup] ${warning}`);
  }

  if (autoApplySchema) {
    await applySchemaOnStartup();
  }

  if (autoBootstrapAdmin) {
    await bootstrapAdminOnStartup();
  }
}

module.exports = {
  applySchemaOnStartup,
  bootstrapAdminOnStartup,
  ensureAdminUserFromEnv,
  runStartupTasks,
};
