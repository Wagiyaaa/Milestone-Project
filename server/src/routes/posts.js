const express = require("express");
const multer = require("multer");
const { z } = require("zod");

const pool = require("../db");
const { requireAuth } = require("../middleware/requireAuth");
const { errorResponse } = require("../utils/errorResponse");
const { saveImage, deleteImageByPath } = require("../utils/imageStorage");
const { writeAuditLog, buildRequestContext } = require("../utils/auditLogger");
const { listPosts, getPostVisibility } = require("../services/postService");
const { getPostNumericMutationParts } = require("../utils/postSchemaCompat");
const { uploadMaxMb } = require("../config/runtime");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadMaxMb * 1024 * 1024 },
});

const createPostSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120, "Title is too long."),
  body: z.string().trim().min(1, "Post text is required.").max(5000, "Post text is too long."),
  read_time_minutes: z.coerce
    .number()
    .int("Estimated read time must be a whole number.")
    .min(1, "Estimated read time must be at least 1 minute.")
    .max(120, "Estimated read time must not exceed 120 minutes."),
  reference_count: z.coerce
    .number()
    .int("Reference count must be a whole number.")
    .min(0, "Reference count cannot be negative.")
    .max(50, "Reference count must not exceed 50."),
});

const commentSchema = z.object({
  body: z.string().trim().min(1, "Comment is required.").max(1000, "Comment is too long."),
});

function collectZodErrors(parsed) {
  const errors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path?.[0];
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }

  return errors;
}

async function ensureVisiblePost(postId, includeHidden = false) {
  const post = await getPostVisibility(postId);
  if (!post) return null;
  if (!includeHidden && post.is_hidden) return null;
  return post;
}

router.get("/", async (req, res) => {
  try {
    const viewerId = req.session?.user?.userId || null;
    const posts = await listPosts({ viewerId, includeHidden: false });
    return res.json({ posts });
  } catch (err) {
    console.error(`[${req.id}] /posts error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  let imagePath = null;

  try {
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors: collectZodErrors(parsed),
        request_id: req.id,
      });
    }

    if (req.file) {
      imagePath = await saveImage(req.file, "posts");
    }

    const numericMutation = await getPostNumericMutationParts();
    const result = await pool.query(
      `
        INSERT INTO posts (author_id, title, body, image_path, read_time_minutes, ${numericMutation.column})
        VALUES ($1::uuid, $2, $3, $4, $5, $6)
        RETURNING id, title, body, image_path, read_time_minutes, ${numericMutation.returning}, created_at
      `,
      [
        req.session.user.userId,
        parsed.data.title,
        parsed.data.body,
        imagePath,
        parsed.data.read_time_minutes,
        parsed.data.reference_count,
      ]
    );

    const post = result.rows[0];

    await writeAuditLog({
      category: "transaction",
      action: "post.create",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      target_type: "post",
      target_id: post.id,
      details: {
        has_image: Boolean(post.image_path),
        read_time_minutes: post.read_time_minutes,
        reference_count: post.reference_count,
      },
      request: buildRequestContext(req),
    });

    return res.status(201).json({ post });
  } catch (err) {
    if (imagePath) {
      await deleteImageByPath(imagePath, "posts");
    }

    if (err?.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors: { image: "Post image must be a JPEG or PNG." },
        request_id: req.id,
      });
    }

    console.error(`[${req.id}] /posts create error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.post("/:postId/comments", requireAuth, async (req, res) => {
  try {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors: collectZodErrors(parsed),
        request_id: req.id,
      });
    }

    const post = await ensureVisiblePost(req.params.postId, req.session.user.role === "admin");
    if (!post) {
      return res.status(404).json({ message: "Post not found.", request_id: req.id });
    }

    const result = await pool.query(
      `
        INSERT INTO comments (post_id, author_id, body)
        VALUES ($1::uuid, $2::uuid, $3)
        RETURNING id, post_id, body, created_at
      `,
      [req.params.postId, req.session.user.userId, parsed.data.body]
    );

    await writeAuditLog({
      category: "transaction",
      action: "comment.create",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      target_type: "comment",
      target_id: result.rows[0].id,
      related_post_id: req.params.postId,
      request: buildRequestContext(req),
    });

    return res.status(201).json({ comment: result.rows[0] });
  } catch (err) {
    console.error(`[${req.id}] /posts/:postId/comments error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.post("/:postId/likes", requireAuth, async (req, res) => {
  try {
    const post = await ensureVisiblePost(req.params.postId, req.session.user.role === "admin");
    if (!post) {
      return res.status(404).json({ message: "Post not found.", request_id: req.id });
    }

    const result = await pool.query(
      `
        INSERT INTO post_likes (post_id, user_id)
        VALUES ($1::uuid, $2::uuid)
        ON CONFLICT (post_id, user_id) DO NOTHING
        RETURNING post_id
      `,
      [req.params.postId, req.session.user.userId]
    );

    if (result.rowCount > 0) {
      await writeAuditLog({
        category: "transaction",
        action: "post.like",
        actor_user_id: req.session.user.userId,
        actor_role: req.session.user.role,
        target_type: "post",
        target_id: req.params.postId,
        request: buildRequestContext(req),
      });
    }

    return res.json({ liked: true });
  } catch (err) {
    console.error(`[${req.id}] /posts/:postId/likes create error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.delete("/:postId/likes", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
        DELETE FROM post_likes
        WHERE post_id = $1::uuid
          AND user_id = $2::uuid
        RETURNING post_id
      `,
      [req.params.postId, req.session.user.userId]
    );

    if (result.rowCount > 0) {
      await writeAuditLog({
        category: "transaction",
        action: "post.unlike",
        actor_user_id: req.session.user.userId,
        actor_role: req.session.user.role,
        target_type: "post",
        target_id: req.params.postId,
        request: buildRequestContext(req),
      });
    }

    return res.json({ liked: false });
  } catch (err) {
    console.error(`[${req.id}] /posts/:postId/likes delete error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

module.exports = router;
