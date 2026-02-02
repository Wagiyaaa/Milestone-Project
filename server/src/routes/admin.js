const express = require("express");
const pool = require("../db");
const { requireAdmin } = require("../middleware/requireAuth");

const router = express.Router();

/**
 * GET /admin/users
 * Admin-only list of users (no secrets).
 */
router.get("/users", requireAdmin, async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT id, full_name, email, phone_e164, role, is_active, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 200`
        );

        return res.json({ users: r.rows });
    } catch (err) {
        console.error(`[${req.id}] /admin/users error`, err.message);
        return res.status(500).json({ message: "Something went wrong.", request_id: req.id });
    }
});

module.exports = router;
