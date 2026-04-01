const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

function makeTinyPngBlob() {
  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sXh6sQAAAAASUVORK5CYII=";
  const buffer = Buffer.from(pngBase64, "base64");
  return new Blob([buffer], { type: "image/png" });
}

function createCookieJar() {
  let cookie = "";

  return {
    apply(headers = {}) {
      return cookie ? { ...headers, Cookie: cookie } : headers;
    },
    capture(response) {
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        cookie = setCookie.match(/^[^;]+/)?.[0] || "";
      }
    },
  };
}

if (!TEST_DATABASE_URL) {
  test("smoke tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  const dbName = (() => {
    try {
      return new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
    } catch {
      return "";
    }
  })();

  if (!/test|smoke/i.test(dbName)) {
    test("smoke tests require a dedicated test database", () => {
      throw new Error("TEST_DATABASE_URL must point to a database whose name includes 'test' or 'smoke'.");
    });
  } else {
    let server;
    let baseUrl;
    let pool;
    let hiddenTarget;

    test.before(async () => {
      process.env.DATABASE_URL = TEST_DATABASE_URL;
      process.env.SESSION_SECRET = process.env.SESSION_SECRET || "smoke-test-secret";
      process.env.NODE_ENV = "test";

      pool = new Pool({ connectionString: TEST_DATABASE_URL });

      const { applySchema, ensureUser, createPost, truncateForSmokeTests } = require("../scripts/lib/seedHelpers");
      const app = require("../src/app");

      const client = await pool.connect();
      try {
        await applySchema(client);
        await truncateForSmokeTests(client);

        await ensureUser(client, {
          full_name: "Smoke Admin",
          email: "smoke-admin@example.com",
          phone_e164: "+639171200001",
          password: "AdminPass12345!",
          role: "admin",
        });

        await ensureUser(client, {
          full_name: "Smoke User",
          email: "smoke-user@example.com",
          phone_e164: "+639171200002",
          password: "UserPass12345!",
          role: "user",
        });

        const otherUser = await ensureUser(client, {
          full_name: "Smoke Reader",
          email: "smoke-reader@example.com",
          phone_e164: "+639171200003",
          password: "ReaderPass12345!",
          role: "user",
        });

        hiddenTarget = await createPost(client, {
          author_id: otherUser.id,
          title: "Hidden moderation target",
          body: "This post should disappear from the public feed after moderation.",
          read_time_minutes: 3,
          reference_count: 2,
        });
      } finally {
        client.release();
      }

      server = app.listen(0);
      await new Promise((resolve) => server.once("listening", resolve));
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
    });

    test.after(async () => {
      if (server) {
        await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
      }

      if (pool) {
        await pool.end();
      }
    });

    test("registration rejects confirm password mismatch", async () => {
      const form = new FormData();
      form.append("full_name", "Mismatch User");
      form.append("email", "mismatch@example.com");
      form.append("phone_e164", "+639171200004");
      form.append("password", "StrongPass12345!");
      form.append("confirm_password", "DifferentPass12345!");
      form.append("profile_photo", makeTinyPngBlob(), "avatar.png");

      const response = await fetch(`${baseUrl}/auth/register`, {
        method: "POST",
        body: form,
      });
      const data = await response.json();

      assert.equal(response.status, 400);
      assert.equal(data.errors.confirm_password, "Passwords do not match.");
    });

    test("guest cannot create a post", async () => {
      const form = new FormData();
      form.append("title", "Unauthorized post");
      form.append("body", "Guests should not be able to create this.");
      form.append("read_time_minutes", "2");
      form.append("reference_count", "1");

      const response = await fetch(`${baseUrl}/posts`, {
        method: "POST",
        body: form,
      });

      assert.equal(response.status, 401);
    });

    test("regular user is forbidden from admin routes", async () => {
      const jar = createCookieJar();

      const loginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "smoke-user@example.com",
          password: "UserPass12345!",
        }),
      });

      jar.capture(loginResponse);
      assert.equal(loginResponse.status, 200);

      const response = await fetch(`${baseUrl}/admin/users`, {
        headers: jar.apply(),
      });

      assert.equal(response.status, 403);
    });

    test("admin can hide a post and it disappears from the public feed", async () => {
      const adminJar = createCookieJar();

      const loginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "smoke-admin@example.com",
          password: "AdminPass12345!",
        }),
      });
      adminJar.capture(loginResponse);
      assert.equal(loginResponse.status, 200);

      const moderationResponse = await fetch(`${baseUrl}/admin/posts/${hiddenTarget.id}/moderation`, {
        method: "PATCH",
        headers: adminJar.apply({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "hide",
          reason: "Smoke test moderation",
        }),
      });

      assert.equal(moderationResponse.status, 200);

      const publicFeedResponse = await fetch(`${baseUrl}/posts`);
      const feed = await publicFeedResponse.json();

      assert.equal(publicFeedResponse.status, 200);
      assert.equal(feed.posts.some((post) => post.id === hiddenTarget.id), false);
    });
  }
}
