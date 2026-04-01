const express = require("express");
const pool = require("../db");
const { requireAdmin } = require("../middleware/requireAuth");
const { errorResponse } = require("../utils/errorResponse");
const { writeAuditLog, buildRequestContext } = require("../utils/auditLogger");
const { listPosts, listPostsByAuthor, listEngagedPosts, getPostVisibility } = require("../services/postService");
const { z } = require("zod");
const { deleteImageByPath } = require("../utils/imageStorage");
const { getPostNumericMutationParts } = require("../utils/postSchemaCompat");

const router = express.Router();

const editPostSchema = z.object({
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

const moderationSchema = z.object({
  action: z.enum(["hide", "restore"]),
  reason: z.string().trim().max(200, "Reason is too long.").optional().default(""),
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

/**
 * GET /admin/users
 * Admin-only list of users (no secrets).
 */
router.get("/users", requireAdmin, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const r = await client.query(
      `SELECT
         u.id,
         u.full_name,
         u.email,
         u.phone_e164,
         u.role,
         u.is_active,
         u.created_at,
         COALESCE(p.post_count, 0)::int AS post_count,
         COALESCE(c.comment_count, 0)::int AS comment_count,
         COALESCE(l.like_count, 0)::int AS like_count
       FROM users u
       LEFT JOIN (
         SELECT author_id, COUNT(*)::int AS post_count
         FROM posts
         GROUP BY author_id
       ) p
         ON p.author_id = u.id
       LEFT JOIN (
         SELECT author_id, COUNT(*)::int AS comment_count
         FROM comments
         GROUP BY author_id
       ) c
         ON c.author_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS like_count
         FROM post_likes
         GROUP BY user_id
       ) l
         ON l.user_id = u.id
       ORDER BY u.created_at DESC
       LIMIT 200`
    );

    await writeAuditLog({
      category: "admin",
      action: "users.list",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      request: buildRequestContext(req),
    });

    return res.json({ users: r.rows });
  } catch (err) {
    console.error(`[${req.id}] /admin/users error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  } finally {
    if (client) client.release();
  }
});

router.get("/users/:userId", requireAdmin, async (req, res) => {
  let client;

  try {
    client = await pool.connect();
    const userResult = await client.query(
      `
        SELECT id, full_name, email, phone_e164, role, is_active, profile_photo_path, created_at, updated_at
        FROM users
        WHERE id = $1::uuid
        LIMIT 1
      `,
      [req.params.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found.", request_id: req.id });
    }

    const [authored_posts, engaged_posts] = await Promise.all([
      listPostsByAuthor({
        authorId: req.params.userId,
        viewerId: req.session.user.userId,
        includeHidden: true,
      }),
      listEngagedPosts({
        userId: req.params.userId,
        viewerId: req.session.user.userId,
        includeHidden: true,
      }),
    ]);

    await writeAuditLog({
      category: "admin",
      action: "user.view",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      target_type: "user",
      target_id: req.params.userId,
      request: buildRequestContext(req),
    });

    return res.json({
      profile: userResult.rows[0],
      authored_posts,
      engaged_posts,
    });
  } catch (err) {
    console.error(`[${req.id}] /admin/users/:userId error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  } finally {
    if (client) client.release();
  }
});

router.get("/posts", requireAdmin, async (req, res) => {
  try {
    const posts = await listPosts({
      viewerId: req.session.user.userId,
      includeHidden: true,
    });

    await writeAuditLog({
      category: "admin",
      action: "posts.list",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      request: buildRequestContext(req),
    });

    return res.json({ posts });
  } catch (err) {
    console.error(`[${req.id}] /admin/posts error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.patch("/posts/:postId", requireAdmin, async (req, res) => {
  try {
    const parsed = editPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors: collectZodErrors(parsed),
        request_id: req.id,
      });
    }

    const numericMutation = await getPostNumericMutationParts();
    const result = await pool.query(
      `
        UPDATE posts
        SET title = $2,
            body = $3,
            read_time_minutes = $4,
            ${numericMutation.column} = $5,
            updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id, title, body, read_time_minutes, ${numericMutation.returning}, updated_at
      `,
      [
        req.params.postId,
        parsed.data.title,
        parsed.data.body,
        parsed.data.read_time_minutes,
        parsed.data.reference_count,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Post not found.", request_id: req.id });
    }

    await writeAuditLog({
      category: "admin",
      action: "post.edit",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      target_type: "post",
      target_id: req.params.postId,
      details: {
        read_time_minutes: parsed.data.read_time_minutes,
        reference_count: parsed.data.reference_count,
      },
      request: buildRequestContext(req),
    });

    return res.json({ post: result.rows[0] });
  } catch (err) {
    console.error(`[${req.id}] /admin/posts/:postId patch error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.patch("/posts/:postId/moderation", requireAdmin, async (req, res) => {
  try {
    const parsed = moderationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Please fix the highlighted fields.",
        errors: collectZodErrors(parsed),
        request_id: req.id,
      });
    }

    const isHidden = parsed.data.action === "hide";
    const reason = parsed.data.action === "hide" ? parsed.data.reason || null : null;

    const result = await pool.query(
      `
        UPDATE posts
        SET is_hidden = $2,
            hidden_reason = $3,
            hidden_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
            hidden_by = CASE WHEN $2 THEN $4::uuid ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1::uuid
        RETURNING id, is_hidden, hidden_reason, hidden_at
      `,
      [req.params.postId, isHidden, reason, req.session.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Post not found.", request_id: req.id });
    }

    await writeAuditLog({
      category: "admin",
      action: isHidden ? "post.hide" : "post.restore",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      target_type: "post",
      target_id: req.params.postId,
      details: { reason },
      request: buildRequestContext(req),
    });

    return res.json({ post: result.rows[0] });
  } catch (err) {
    console.error(`[${req.id}] /admin/posts/:postId/moderation error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  }
});

router.delete("/posts/:postId", requireAdmin, async (req, res) => {
  let client;

  try {
    const existingPost = await getPostVisibility(req.params.postId);
    if (!existingPost) {
      return res.status(404).json({ message: "Post not found.", request_id: req.id });
    }

    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("DELETE FROM posts WHERE id = $1::uuid", [req.params.postId]);
    await client.query("COMMIT");

    if (existingPost.image_path) {
      await deleteImageByPath(existingPost.image_path, "posts");
    }

    await writeAuditLog({
      category: "admin",
      action: "post.delete",
      actor_user_id: req.session.user.userId,
      actor_role: req.session.user.role,
      target_type: "post",
      target_id: req.params.postId,
      request: buildRequestContext(req),
    });

    return res.json({ ok: true });
  } catch (err) {
    if (client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error(`[${req.id}] /admin/posts/:postId delete error`, err.message);
    return errorResponse(res, req, 500, "Something went wrong.", err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
