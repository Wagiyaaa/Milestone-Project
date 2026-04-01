const pool = require("../db");
const { getPostNumericSelect } = require("../utils/postSchemaCompat");

async function fetchPosts({ viewerId = null, includeHidden = false, whereSql = "TRUE", params = [] } = {}) {
  const numericSelect = await getPostNumericSelect("p");
  const values = [viewerId, includeHidden, ...params];
  const postsResult = await pool.query(
    `
      SELECT
        p.id,
        p.author_id,
        p.title,
        p.body,
        p.image_path,
        p.read_time_minutes,
        ${numericSelect},
        p.is_hidden,
        p.hidden_reason,
        p.hidden_at,
        p.created_at,
        p.updated_at,
        u.full_name AS author_name,
        u.profile_photo_path AS author_profile_photo_path,
        COALESCE(l.like_count, 0)::int AS like_count,
        COALESCE(c.comment_count, 0)::int AS comment_count,
        CASE
          WHEN $1::uuid IS NULL THEN false
          ELSE EXISTS (
            SELECT 1
            FROM post_likes my_likes
            WHERE my_likes.post_id = p.id
              AND my_likes.user_id = $1::uuid
          )
        END AS liked_by_me
      FROM posts p
      JOIN users u
        ON u.id = p.author_id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS like_count
        FROM post_likes
        GROUP BY post_id
      ) l
        ON l.post_id = p.id
      LEFT JOIN (
        SELECT post_id, COUNT(*)::int AS comment_count
        FROM comments
        GROUP BY post_id
      ) c
        ON c.post_id = p.id
      WHERE (${whereSql})
        AND ($2::boolean = true OR p.is_hidden = false)
      ORDER BY p.created_at DESC, p.id DESC
    `,
    values
  );

  const postIds = postsResult.rows.map((post) => post.id);
  const commentsByPostId = new Map();

  if (postIds.length > 0) {
    const commentsResult = await pool.query(
      `
        SELECT
          c.id,
          c.post_id,
          c.author_id,
          c.body,
          c.created_at,
          c.updated_at,
          u.full_name AS author_name,
          u.profile_photo_path AS author_profile_photo_path
        FROM comments c
        JOIN users u
          ON u.id = c.author_id
        WHERE c.post_id = ANY($1::uuid[])
        ORDER BY c.created_at ASC, c.id ASC
      `,
      [postIds]
    );

    for (const comment of commentsResult.rows) {
      if (!commentsByPostId.has(comment.post_id)) {
        commentsByPostId.set(comment.post_id, []);
      }

      commentsByPostId.get(comment.post_id).push(comment);
    }
  }

  return postsResult.rows.map((post) => ({
    ...post,
    comments: commentsByPostId.get(post.id) || [],
  }));
}

async function listPosts({ viewerId = null, includeHidden = false } = {}) {
  return fetchPosts({ viewerId, includeHidden });
}

async function listPostsByAuthor({ authorId, viewerId = null, includeHidden = false }) {
  return fetchPosts({
    viewerId,
    includeHidden,
    whereSql: "p.author_id = $3::uuid",
    params: [authorId],
  });
}

async function listEngagedPosts({ userId, viewerId = null, includeHidden = false }) {
  return fetchPosts({
    viewerId,
    includeHidden,
    whereSql: `
      p.id IN (
        SELECT post_id
        FROM post_likes
        WHERE user_id = $3::uuid
        UNION
        SELECT post_id
        FROM comments
        WHERE author_id = $3::uuid
      )
      AND p.author_id <> $3::uuid
    `,
    params: [userId],
  });
}

async function getPostVisibility(postId) {
  const result = await pool.query(
    `
      SELECT id, author_id, image_path, is_hidden
      FROM posts
      WHERE id = $1::uuid
      LIMIT 1
    `,
    [postId]
  );

  return result.rows[0] || null;
}

module.exports = {
  getPostVisibility,
  listPosts,
  listPostsByAuthor,
  listEngagedPosts,
};
