const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

// If connecting to a hosted DB (Render, Supabase, Neon, etc.), SSL is usually required.
const needsSsl =
    process.env.DATABASE_SSL === "true" ||
    /render\.com|supabase\.com|neon\.tech|railway\.app/i.test(connectionString || "");

const pool = new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
