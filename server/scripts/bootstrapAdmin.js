require("dotenv").config();

const pool = require("../src/db");
const { applySchema } = require("../src/startup/schema");
const { ensureAdminUserFromEnv } = require("../src/startup/bootstrap");

async function main() {
  const client = await pool.connect();
  try {
    await applySchema(client);
    const admin = await ensureAdminUserFromEnv(client);

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
