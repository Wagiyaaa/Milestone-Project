const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const app = express();

const cors = require("cors");

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

const pool = require("./db");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const sessionTimeout = require("./middleware/sessionTimeout");

const PgSession = require("connect-pg-simple")(session);

const IS_PRODUCTION = process.env.NODE_ENV === "production";

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

app.use(helmet({
  contentSecurityPolicy: false,
}));

// request id
app.use((req, res, next) => {
  req.id = req.id || crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
});

// json parser
app.use(express.json({ limit: "1mb" }));

// invalid JSON => 400
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON body.", request_id: req.id });
  }
  next(err);
});

// sessions in postgres
app.use(
  session({
    name: "sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new PgSession({
      pool,
      tableName: "user_sessions",
    }),
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: IS_PRODUCTION,
      maxAge: (Number(process.env.SESSION_ABSOLUTE_HOURS) || 8) * 60 * 60 * 1000,
    },
  })
);

// session timeout enforcement
app.use(sessionTimeout);

// uploads (default: server/uploads, or persistent disk via UPLOAD_DIR)
const uploadsBase = process.env.UPLOAD_DIR || path.resolve(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsBase, { fallthrough: false }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);

// serve React build in production
if (IS_PRODUCTION) {
  const rootDir = path.resolve(__dirname, "..", ".."); // repo root
  const distPath = path.join(rootDir, "client", "dist");

  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.use((err, req, res, next) => {
  const isDebug = !IS_PRODUCTION;
 
  // Multer file-size / upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = Number(process.env.UPLOAD_MAX_MB || 5);
      return res.status(413).json({
        message: "Profile photo is too large.",
        errors: { profile_photo: `Max size is ${maxMb}MB.` },
        request_id: req.id,
      });
    }
    return res.status(400).json({
      message: "Please fix the highlighted fields.",
      errors: { profile_photo: "Upload failed." },
      request_id: req.id,
    });
  }
 
  // All other unhandled errors
  console.error(`[${req.id}] unhandled error`, err?.message || err);
  if (isDebug) console.error(err?.stack);
 
  const body = { message: "Something went wrong.", request_id: req.id };
  if (isDebug) {
    body.debug = { error: err?.message, stack: err?.stack };
  }
 
  return res.status(500).json(body);
});
 
module.exports = app;
