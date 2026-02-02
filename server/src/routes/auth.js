const multer = require("multer");
const bcrypt = require("bcrypt");
const { z } = require("zod");
const { saveProfilePhoto, deleteProfilePhotoByPath } = require("../utils/profilePhoto");

const express = require("express");
const pool = require("../db");

const router = express.Router();

function unauthorized(res) {
    return res.status(401).json({ message: "Not authenticated." });
}

const maxMb = Number(process.env.UPLOAD_MAX_MB || 5);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024 },
});

const registerSchema = z.object({
    full_name: z.string().trim().min(1, "Full name is required.").max(100, "Full name is too long."),
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Enter a valid email address.")
        .max(254, "Email is too long."),
    phone_e164: z
        .string()
        .trim()
        .regex(/^\+[1-9]\d{1,14}$/, "Use E.164 format (e.g., +639171234567)."),
    password: z.string().min(12, "Password must be at least 12 characters."),
});

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(1, "Password is required."),
});

function normalizeIp(ip) {
    // Express on Windows/local can show IPv6-mapped IPv4 like ::ffff:127.0.0.1
    if (typeof ip !== "string") return "";
    if (ip.startsWith("::ffff:")) return ip.slice(7);
    return ip;
}

const EMAIL_FAIL_LIMIT = 5;
const IP_FAIL_LIMIT = 20;
const WINDOW_MINUTES = 15;

async function countRecentFailsByEmail(email) {
    const q = `
    SELECT COUNT(*)::int AS cnt
    FROM auth_attempts
    WHERE email_attempted = $1
      AND success = false
      AND attempted_at > NOW() - ($2::text || ' minutes')::interval
  `;
    const r = await pool.query(q, [email, String(WINDOW_MINUTES)]);
    return r.rows[0].cnt;
}

async function countRecentFailsByIp(ip) {
    const q = `
    SELECT COUNT(*)::int AS cnt
    FROM auth_attempts
    WHERE ip_address = $1::inet
      AND success = false
      AND attempted_at > NOW() - ($2::text || ' minutes')::interval
  `;
    const r = await pool.query(q, [ip, String(WINDOW_MINUTES)]);
    return r.rows[0].cnt;
}

async function logAuthAttempt({ email, userId, ip, userAgent, success, failureCode, requestId }) {
    await pool.query(
        `INSERT INTO auth_attempts
      (email_attempted, user_id, ip_address, user_agent, success, failure_code, request_id)
     VALUES ($1, $2, $3::inet, $4, $5, $6, $7)`,
        [email, userId || null, ip, userAgent || null, success, failureCode || null, requestId || null]
    );
}


// existing routes
router.get("/me", async (req, res) => {
    try {
        const userId = req.session?.user?.userId;
        if (!userId) return unauthorized(res);

        const result = await pool.query(
            `SELECT id, full_name, email, phone_e164, role, profile_photo_path
       FROM users
       WHERE id = $1 AND is_active = true`,
            [userId]
        );

        if (result.rowCount === 0) return unauthorized(res);

        return res.json({ user: result.rows[0] });
    } catch (err) {
        console.error(`[${req.id}] /auth/me error`, err.message);
        return res.status(500).json({ message: "Something went wrong.", request_id: req.id });
    }
});

router.post("/logout", (req, res) => {
    if (!req.session) return res.json({ ok: true });

    req.session.destroy((err) => {
        if (err) {
            console.error(`[${req.id}] logout error`, err.message);
            return res.status(500).json({ message: "Something went wrong.", request_id: req.id });
        }

        res.clearCookie("sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        return res.json({ ok: true });
    });
});

/**
 * POST /auth/register (STEP: photo pipeline only)
 * This step validates + saves the profile photo.
 * Next step we add validation + hashing + DB insert + session.
 */
router.post("/register", upload.single("profile_photo"), async (req, res) => {
    if (req.session?.user?.userId) {
        return res.status(409).json({ message: "Already authenticated.", request_id: req.id });
    }

    let profilePhotoPath = null;

    try {
        // 1) required photo presence check (fast fail)
        if (!req.file) {
            return res.status(400).json({
                message: "Please fix the highlighted fields.",
                errors: { profile_photo: "Profile photo is required." },
                request_id: req.id,
            });
        }

        // 2) validate inputs (server is truth)
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            const errors = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path?.[0];
                if (key && !errors[key]) errors[key] = issue.message;
            }
            return res.status(400).json({
                message: "Please fix the highlighted fields.",
                errors,
                request_id: req.id,
            });
        }

        const { full_name, email, phone_e164, password } = parsed.data;

        // 3) real file type detection + safe save (JPEG/PNG only)
        profilePhotoPath = await saveProfilePhoto(req.file);

        // 4) hash password (salted)
        const passwordHash = await bcrypt.hash(password, 12);

        // 5) insert user (let DB enforce uniqueness)
        const insert = await pool.query(
            `INSERT INTO users (full_name, email, phone_e164, password_hash, role, profile_photo_path, is_active)
       VALUES ($1, $2, $3, $4, 'user', $5, true)
       RETURNING id, full_name, email, phone_e164, role, profile_photo_path`,
            [full_name, email, phone_e164, passwordHash, profilePhotoPath]
        );

        const user = insert.rows[0];

        // 6) session fixation defense: regenerate session, then set auth state
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => (err ? reject(err) : resolve()));
        });

        req.session.user = { userId: user.id, role: user.role };

        return res.status(201).json({ user });
    } catch (err) {
        // If DB insert failed, delete the uploaded photo to avoid orphan files
        if (profilePhotoPath) {
            await deleteProfilePhotoByPath(profilePhotoPath);
        }

        // file-type rejection
        if (err?.code === "INVALID_FILE_TYPE") {
            return res.status(400).json({
                message: "Please fix the highlighted fields.",
                errors: { profile_photo: "Profile photo must be a JPEG or PNG." },
                request_id: req.id,
            });
        }

        // Unique constraint violation (email or phone)
        if (err?.code === "23505") {
            const errors = {};
            // match your constraint names (from your schema)
            if (err.constraint === "users_email_key" || err.constraint === "users_email_key1" || err.constraint === "users_email_key2") {
                errors.email = "Email is already in use.";
            } else if (err.constraint === "users_phone_e164_key") {
                errors.phone_e164 = "Phone number is already in use.";
            } else {
                // fallback: don’t leak which field if unsure
                errors.email = "Email is already in use.";
            }

            return res.status(409).json({
                message: "Account already exists with provided details.",
                errors,
                request_id: req.id,
            });
        }

        console.error(`[${req.id}] /auth/register error`, err.message);
        return res.status(500).json({ message: "Something went wrong.", request_id: req.id });
    }
});

router.post("/login", async (req, res) => {
    if (req.session?.user?.userId) {
        return res.status(409).json({ message: "Already authenticated.", request_id: req.id });
    }

    try {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            const errors = {};
            for (const issue of parsed.error.issues) {
                const key = issue.path?.[0];
                if (key && !errors[key]) errors[key] = issue.message;
            }
            return res.status(400).json({
                message: "Please fix the highlighted fields.",
                errors,
                request_id: req.id,
            });
        }

        const email = parsed.data.email;
        const password = parsed.data.password;

        const ip = normalizeIp(req.ip);
        const userAgent = req.get("user-agent");

        // 1) Brute-force checks (email + IP)
        const [emailFails, ipFails] = await Promise.all([
            countRecentFailsByEmail(email),
            countRecentFailsByIp(ip),
        ]);

        if (emailFails >= EMAIL_FAIL_LIMIT || ipFails >= IP_FAIL_LIMIT) {
            // Log the blocked attempt (server-only reason)
            await logAuthAttempt({
                email,
                userId: null,
                ip,
                userAgent,
                success: false,
                failureCode: "RATE_LIMITED",
                requestId: req.id,
            });

            return res.status(429).json({
                message: "Too many attempts. Try again later.",
                request_id: req.id,
            });
        }

        // 2) Lookup user (don’t reveal if not found)
        const userRes = await pool.query(
            `SELECT id, full_name, email, phone_e164, role, profile_photo_path, password_hash, is_active
       FROM users
       WHERE email = $1
       LIMIT 1`,
            [email]
        );

        const user = userRes.rows[0];

        // If user not found or inactive -> treat as invalid creds (still log)
        if (!user || user.is_active !== true) {
            await logAuthAttempt({
                email,
                userId: user?.id || null,
                ip,
                userAgent,
                success: false,
                failureCode: "INVALID_CREDENTIALS",
                requestId: req.id,
            });

            return res.status(401).json({
                message: "Invalid credentials.",
                request_id: req.id,
            });
        }

        // 3) Compare password hash
        const ok = await bcrypt.compare(password, user.password_hash);

        if (!ok) {
            await logAuthAttempt({
                email,
                userId: user.id,
                ip,
                userAgent,
                success: false,
                failureCode: "INVALID_CREDENTIALS",
                requestId: req.id,
            });

            return res.status(401).json({
                message: "Invalid credentials.",
                request_id: req.id,
            });
        }

        // 4) Success: log + create session
        await logAuthAttempt({
            email,
            userId: user.id,
            ip,
            userAgent,
            success: true,
            failureCode: null,
            requestId: req.id,
        });

        // Prevent session fixation
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => (err ? reject(err) : resolve()));
        });

        req.session.user = { userId: user.id, role: user.role };

        await new Promise((resolve, reject) => {
            req.session.save((err) => (err ? reject(err) : resolve()));
        });

        // Return sanitized user
        const safeUser = {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            phone_e164: user.phone_e164,
            role: user.role,
            profile_photo_path: user.profile_photo_path,
        };

        return res.json({ user: safeUser });
    } catch (err) {
        console.error(`[${req.id}] /auth/login error`, err.message);
        return res.status(500).json({ message: "Something went wrong.", request_id: req.id });
    }
});

module.exports = router;
