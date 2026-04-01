require("dotenv").config();

const pool = require("../src/db");
const {
  addComment,
  addLike,
  applySchema,
  clearDemoPosts,
  createPost,
  ensureUser,
} = require("./lib/seedHelpers");

async function main() {
  const client = await pool.connect();

  try {
    await applySchema(client);

    const admin = await ensureUser(client, {
      full_name: process.env.ADMIN_FULL_NAME || "Render Admin",
      email: process.env.ADMIN_EMAIL || "admin@example.com",
      phone_e164: process.env.ADMIN_PHONE_E164 || "+639111111111",
      password: process.env.ADMIN_PASSWORD || "AdminPass12345!",
      role: "admin",
      is_active: true,
    });

    const aria = await ensureUser(client, {
      full_name: "Aria Reader",
      email: "aria@example.com",
      phone_e164: "+639171000001",
      password: "ReaderPass12345!",
      role: "user",
      is_active: true,
    });

    const ben = await ensureUser(client, {
      full_name: "Ben Commenter",
      email: "ben@example.com",
      phone_e164: "+639171000002",
      password: "CommentPass12345!",
      role: "user",
      is_active: true,
    });

    const demoTitles = [
      "Campus wifi upgrade checklist",
      "What makes a study group actually work?",
      "Security hardening notes for a student project",
    ];

    await clearDemoPosts(client, [admin.id, aria.id, ben.id], demoTitles);

    const postA = await createPost(client, {
      author_id: aria.id,
      title: "Campus wifi upgrade checklist",
      body: "Our org documented the rollout so future officers can repeat it without guessing the steps.",
      read_time_minutes: 4,
      reference_count: 3,
    });

    const postB = await createPost(client, {
      author_id: ben.id,
      title: "What makes a study group actually work?",
      body: "Small groups, a clear topic, and one person writing shared notes helped us more than long general calls.",
      read_time_minutes: 6,
      reference_count: 1,
    });

    const postC = await createPost(client, {
      author_id: admin.id,
      title: "Security hardening notes for a student project",
      body: "Start with sessions, validation, logging, and least privilege before worrying about polish.",
      read_time_minutes: 5,
      reference_count: 5,
    });

    await addComment(client, {
      post_id: postA.id,
      author_id: ben.id,
      body: "This would have saved our block a lot of time last semester.",
    });

    await addComment(client, {
      post_id: postB.id,
      author_id: aria.id,
      body: "Having one shared document made a bigger difference than I expected.",
    });

    await addComment(client, {
      post_id: postC.id,
      author_id: ben.id,
      body: "The logging piece is useful for checking admin activity later on.",
    });

    await addLike(client, { post_id: postA.id, user_id: admin.id });
    await addLike(client, { post_id: postA.id, user_id: ben.id });
    await addLike(client, { post_id: postB.id, user_id: aria.id });
    await addLike(client, { post_id: postC.id, user_id: aria.id });

    console.log("Demo seed complete.");
    console.log(`Admin: ${admin.email}`);
    console.log("Users: aria@example.com, ben@example.com");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (err) => {
  console.error(err.message || err);
  await pool.end().catch(() => {});
  process.exit(1);
});
