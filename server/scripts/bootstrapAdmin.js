require("dotenv").config();

const pool = require("../src/db");
const { applySchema, ensureUser } = require("./lib/seedHelpers");

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error("ADMIN_PASSWORD is required to bootstrap an admin user.");
  }

  const client = await pool.connect();
  try {
    await applySchema(client);

    const admin = await ensureUser(client, {
      full_name: process.env.ADMIN_FULL_NAME || "Render Admin",
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      phone_e164: process.env.ADMIN_PHONE_E164 || "+639111111111",
      password,
      role: "admin",
      is_active: true,
    });

    console.log(`Admin ready: ${admin.email} (${admin.role})`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err.message || err);
  await pool.end().catch(() => {});
  process.exit(1);
});
