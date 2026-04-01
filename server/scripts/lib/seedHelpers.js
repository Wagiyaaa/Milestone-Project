const fs = require("fs/promises");
const path = require("path");
const bcrypt = require("bcrypt");

const { defaultProfilePhotoDataUrl } = require("../../src/utils/defaultProfilePhoto");

const schemaPath = path.resolve(__dirname, "..", "..", "..", "schemas", "init.sql");

async function applySchema(client) {
  const sql = await fs.readFile(schemaPath, "utf8");
  await client.query(sql);
}

async function ensureUser(client, { full_name, email, phone_e164, password, role = "user", is_active = true }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await client.query(
    `
      INSERT INTO users (full_name, email, phone_e164, password_hash, role, profile_photo_path, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          phone_e164 = EXCLUDED.phone_e164,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          profile_photo_path = EXCLUDED.profile_photo_path,
          is_active = EXCLUDED.is_active
      RETURNING id, full_name, email, role
    `,
    [full_name, email, phone_e164, passwordHash, role, defaultProfilePhotoDataUrl(full_name), is_active]
  );

  return result.rows[0];
}

async function clearDemoPosts(client, authorIds, titles) {
  if (authorIds.length === 0 || titles.length === 0) return;

  await client.query(
    `
      DELETE FROM posts
      WHERE author_id = ANY($1::uuid[])
        AND title = ANY($2::text[])
    `,
    [authorIds, titles]
  );
}

async function createPost(client, { author_id, title, body, read_time_minutes, reference_count }) {
  const result = await client.query(
    `
      INSERT INTO posts (author_id, title, body, image_path, read_time_minutes, reference_count)
      VALUES ($1::uuid, $2, $3, NULL, $4, $5)
      RETURNING id, title
    `,
    [author_id, title, body, read_time_minutes, reference_count]
  );

  return result.rows[0];
}

async function addComment(client, { post_id, author_id, body }) {
  await client.query(
    `
      INSERT INTO comments (post_id, author_id, body)
      VALUES ($1::uuid, $2::uuid, $3)
    `,
    [post_id, author_id, body]
  );
}

async function addLike(client, { post_id, user_id }) {
  await client.query(
    `
      INSERT INTO post_likes (post_id, user_id)
      VALUES ($1::uuid, $2::uuid)
      ON CONFLICT (post_id, user_id) DO NOTHING
    `,
    [post_id, user_id]
  );
}

async function truncateForSmokeTests(client) {
  await client.query(
    `
      TRUNCATE TABLE
        post_likes,
        comments,
        posts,
        auth_attempts,
        user_sessions,
        users
      RESTART IDENTITY CASCADE
    `
  );
}

module.exports = {
  addComment,
  addLike,
  applySchema,
  clearDemoPosts,
  createPost,
  ensureUser,
  truncateForSmokeTests,
};
