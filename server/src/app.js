const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const crypto = require("crypto");

const pool = require("./db");

const app = express();


// 1) Request ID (server-only traceability)
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
});

// 2) Basic security headers
app.use(helmet());

// 3) CORS: allow server-to-server calls (no Origin), and allow your React origin later
const allowedOrigin = process.env.CLIENT_ORIGIN;
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman
      if (origin === allowedOrigin) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// 4) Body parsing (for later JSON routes)
app.use(express.json());

// 5) Sessions stored in Postgres (NOT memory)
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      // If your package version supports it, uncomment:
      // createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Test routes
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/db-check", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS ok");
    res.json({ db: "ok", result: result.rows[0] });
  } catch (err) {
    console.error(`[${req.id}] db-check failed`, err.message);
    res.status(500).json({ message: "db error", request_id: req.id });
  }
});

const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);

const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

const path = require("path");
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), { fallthrough: false }));

const multer = require("multer");

app.use((err, req, res, next) => {
  // Multer file size / upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Number(process.env.UPLOAD_MAX_MB || 5);
      return res.status(413).json({
        message: "Profile photo is too large.",
        errors: { profile_photo: `Max size is ${maxMb}MB.` },
        request_id: req.id,
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors: { profile_photo: "Unexpected file field." },
        request_id: req.id,
      });
    }

    // Other multer errors
    return res.status(400).json({
      message: "Please fix the highlighted fields.",
      errors: { profile_photo: "Upload failed." },
      request_id: req.id,
    });
  }

  // Invalid JSON body (from express.json)
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      message: "Invalid JSON body.",
      request_id: req.id,
    });
  }

  // Anything else
  console.error(`[${req.id}] unhandled error`, err?.message || err);
  return res.status(500).json({
    message: "Something went wrong.",
    request_id: req.id,
  });
});

module.exports = app;
