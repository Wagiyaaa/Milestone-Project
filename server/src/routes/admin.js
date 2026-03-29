const express = require("express");
const pool = require("../db");
const { requireAdmin } = require("../middleware/requireAuth");
const { errorResponse } = require("../utils/errorResponse");

const router = express.Router();

/**
 * GET /admin/users
 * Admin-only list of users (no secrets).
 */
router.get("/users", requireAdmin, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const r = await client.query(
      `SELECT id, full_name, email, phone_e164, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 200`
    );

    return res.json({ users: r.rows });
  } catch (err) {
    console.error(`[${req.id}] /admin/users error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;