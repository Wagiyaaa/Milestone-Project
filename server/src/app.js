const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");

const app = express();

const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const postRoutes = require("./routes/posts");
const sessionTimeout = require("./middleware/sessionTimeout");
const {
  corsAllowedOrigins,
  getCorsOptions,
  isProduction,
  sessionCookieOptions,
  uploadMaxMb,
  uploadsBaseDir,
} = require("./config/runtime");
const { buildErrorBody } = require("./utils/errorResponse");

const PgSession = require("connect-pg-simple")(session);

if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

if (corsAllowedOrigins.length > 0) {
  app.use(cors(getCorsOptions()));
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
    cookie: sessionCookieOptions,
  })
);

// session timeout enforcement
app.use(sessionTimeout);

// uploads (default: server/uploads, or persistent disk via UPLOAD_DIR)
app.use("/uploads", express.static(uploadsBaseDir, { fallthrough: false }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/posts", postRoutes);
app.use("/admin", adminRoutes);

// serve React build in production
if (isProduction) {
  const rootDir = path.resolve(__dirname, "..", ".."); // repo root
  const distPath = path.join(rootDir, "client", "dist");

  app.use(express.static(distPath));
  app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.use((err, req, res, next) => {
  // Multer file-size / upload errors
  if (err instanceof multer.MulterError) {
    const uploadField = req.originalUrl?.startsWith("/auth/register") ? "profile_photo" : "image";
    const uploadLabel = uploadField === "profile_photo" ? "Profile photo" : "Image";

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        message: `${uploadLabel} is too large.`,
        errors: { [uploadField]: `Max size is ${uploadMaxMb}MB.` },
        request_id: req.id,
      });
    }
    return res.status(400).json({
      message: "Please fix the highlighted fields.",
      errors: { [uploadField]: "Upload failed." },
      request_id: req.id,
    });
  }
 
  // All other unhandled errors
  console.error(`[${req.id}] unhandled error`, err?.message || err);
  return res.status(500).json(buildErrorBody(req, "Something went wrong.", err));
});
 
module.exports = app;
