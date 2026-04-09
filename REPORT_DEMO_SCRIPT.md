# Milestone Project Report And Demo Script

## 1. Project Overview

This project is a security-focused Reddit-style community application built with PostgreSQL, Express, React, and Node.js.

The main goals of the project were:

- store and display user-generated content in a SQL database
- support regular-user and admin-user workflows
- secure authentication and session handling
- validate uploads and user input
- log important security and business events
- provide controlled error handling
- support HTTPS

The deployed version runs on Render over HTTPS, and the local version also supports optional self-signed HTTPS for development and demonstration.

## 2. High-Level Architecture

### Backend

- `server/src/app.js`
  Main Express application. Registers middleware, sessions, security headers, routes, static file serving, and global error handling.
- `server/src/index.js`
  Startup entry point. Loads environment variables, runs startup tasks, and starts either HTTP or HTTPS.
- `server/src/db.js`
  Creates the PostgreSQL connection pool.
- `server/src/routes/auth.js`
  Registration, login, logout, and current-session user lookup.
- `server/src/routes/posts.js`
  Public feed, post creation, commenting, and like/unlike actions.
- `server/src/routes/admin.js`
  Admin-only user management and post moderation routes.

### Frontend

- `client/src/App.jsx`
  Main router and session-aware layout.
- `client/src/pages/Home.jsx`
  Community feed and post composer page.
- `client/src/components/PostComposer.jsx`
  Form for creating new posts with text, numeric fields, and optional image.
- `client/src/components/PostCard.jsx`
  Feed card, like/unlike, comment submission, admin controls, and full-image viewer.
- `client/src/pages/AdminUsers.jsx`
  Admin list of all users.
- `client/src/pages/AdminUserDetail.jsx`
  Admin detail page for a selected user, including authored and engaged posts.
- `client/src/pages/AdminPosts.jsx`
  Admin view of all posts, including hidden posts.

### Database

- `schemas/init.sql`
  Database schema definition and schema migration compatibility logic.

## 3. Database Schema Description

The schema is fully SQL-based and stored in `schemas/init.sql`.

### `users`

- Stores account identity and profile information.
- Important columns:
  - `id`
  - `full_name`
  - `email`
  - `phone_e164`
  - `password_hash`
  - `role`
  - `profile_photo_path`
  - `is_active`

### `user_sessions`

- Stores session records for authenticated users.
- Used by `express-session` with `connect-pg-simple`.
- Keeps session state on the server side instead of the browser.

### `auth_attempts`

- Stores login-attempt telemetry.
- Used for brute-force monitoring and rate-limit decisions.
- Tracks email, IP address, success/failure state, and request ID.

### `posts`

- Stores community posts.
- Important columns:
  - `author_id`
  - `title`
  - `body`
  - `image_path`
  - `read_time_minutes`
  - `reference_count`
  - moderation metadata such as `is_hidden`, `hidden_reason`, `hidden_at`, and `hidden_by`

### `comments`

- Stores comments attached to posts.
- Links each comment to a post and a user.

### `post_likes`

- Stores likes on posts.
- Uses a composite primary key so a user can only like a given post once.

## 4. Schema Initialization And Bootstrapping

### Schema initialization

- File: `schemas/init.sql`
- Applied manually with `psql`, or automatically when `AUTO_APPLY_SCHEMA=true`.
- Startup schema support is implemented in:
  - `server/src/startup/schema.js`
  - `server/src/startup/bootstrap.js`
  - `server/src/index.js`

### Why this approach was chosen

- It keeps the application SQL-based, which matches the project requirement.
- It allows a fresh environment to be initialized quickly.
- It supports deployment convenience while still keeping the schema explicit and reviewable.

### Admin bootstrap

- Admin bootstrap is supported through environment variables.
- Implemented in:
  - `server/src/startup/bootstrap.js`
  - `server/scripts/bootstrapAdmin.js`

This makes it possible to create or refresh an admin account on startup or through a script without hardcoding credentials in source files.

## 5. Password Storage And Authentication Design

### Password storage

- File: `server/src/routes/auth.js`
- Passwords are never stored in plaintext.
- Passwords are hashed with `bcrypt`.
- The stored value is a salted password hash in the `users.password_hash` column.

### Why this was chosen

- Plaintext storage would be insecure and unacceptable.
- Salted hashing makes offline password cracking much harder if the database is exposed.
- `bcrypt` is a standard and widely accepted password hashing approach for Node applications.

### Authentication flow

- Registration validates text fields and required profile photo upload.
- Login checks email and password.
- On successful login, the server regenerates the session to reduce session fixation risk.
- The browser receives only the session cookie, not the password hash or raw credentials.

Implemented in:

- `server/src/routes/auth.js`
- `server/src/app.js`

## 6. Session Handling And Timeout

### Session storage

- Sessions are stored in PostgreSQL rather than memory.
- Implemented in:
  - `server/src/app.js`
  - `server/src/db.js`

### Timeout implementation

- Idle timeout and absolute timeout are enforced in:
  - `server/src/middleware/sessionTimeout.js`

### Why this was chosen

- Database-backed sessions survive process restarts better than in-memory sessions.
- Timeouts reduce the risk of stale authenticated sessions being reused.
- Cookie settings are hardened through:
  - `HttpOnly`
  - `Secure` in production
  - `SameSite`

## 7. Logging Features

The application logs:

- authentication actions
- transaction actions
- administrative actions

### Implementation

- `server/src/utils/auditLogger.js`
- Used from:
  - `server/src/routes/auth.js`
  - `server/src/routes/posts.js`
  - `server/src/routes/admin.js`
  - `server/src/middleware/sessionTimeout.js`

### Categories

- `auth`
  Login attempts, logout, registration, and session expiration.
- `transaction`
  Post creation, comment creation, like, and unlike actions.
- `admin`
  User listing, user profile viewing, post listing, moderation, editing, and deletion.

### Security design

- Request data is sanitized before logging.
- Strings are truncated.
- Log destination is configurable.
- Local file logging is supported.
- Standard output logging is also supported for hosted environments like Render.

## 8. Error Messaging

### Requirement

- detailed stack trace when debug is enabled
- generic error message when debug is disabled

### Implementation

- `server/src/utils/errorResponse.js`
- `server/src/app.js`
- `server/src/config/runtime.js`

### Behavior

- When `DEBUG_ERRORS=true`, error responses include:
  - error message
  - stack trace
- When `DEBUG_ERRORS=false`, the API returns a generic message such as:
  - `Something went wrong.`

### Why this was chosen

- Detailed errors help development and debugging.
- Generic errors reduce information leakage in production.
- Request IDs still allow server-side correlation without exposing internal details to users.

## 9. Upload Handling And File Validation

### Features implemented

- required profile photo on registration
- optional image upload on posts
- JPEG/PNG validation
- upload size limit
- server-side file type verification

### Implementation

- `server/src/routes/auth.js`
- `server/src/routes/posts.js`
- `server/src/utils/imageStorage.js`
- `server/src/utils/profilePhoto.js`

### Why this was chosen

- Browser-provided file names and MIME types are not trustworthy.
- The server checks the actual file signature before saving.
- File-size limits help reduce abuse and denial-of-service risk.

## 10. HTTPS Implementation

### Live deployment

- The Render deployment already uses HTTPS publicly.
- This satisfies the requirement for the deployed application.

### Local self-signed HTTPS

- Optional self-signed HTTPS support was added for local or self-hosted use.
- Implemented in:
  - `server/src/startup/https.js`
  - `server/src/index.js`
  - `server/src/config/runtime.js`

### How it works

- When `HTTPS_ENABLED=true`, the server generates a self-signed certificate if one does not already exist.
- The generated certificate and key are stored under `server/certs/`.
- Those certificate files are ignored in `.gitignore`.

### Why this was chosen

- The requirement explicitly allowed self-signed certificates.
- This keeps the implementation simple while still demonstrating HTTPS support.
- On Render, this feature should remain off because Render already terminates TLS.

## 11. Requirement Checklist With Implementation Locations

### 1. SQL based

- Implemented through PostgreSQL schema and SQL queries.
- Files:
  - `schemas/init.sql`
  - `server/src/db.js`
  - `server/src/routes/auth.js`
  - `server/src/routes/posts.js`
  - `server/src/routes/admin.js`
  - `server/src/services/postService.js`

### 2. Save and display text input

- Posts save and display `title` and `body`.
- Comments save and display `body`.
- Files:
  - `server/src/routes/posts.js`
  - `server/src/services/postService.js`
  - `client/src/components/PostComposer.jsx`
  - `client/src/components/PostCard.jsx`

### 3. At least 2 numeric input fields

- `read_time_minutes`
- `reference_count`
- Files:
  - `schemas/init.sql`
  - `server/src/routes/posts.js`
  - `server/src/routes/admin.js`
  - `client/src/components/PostComposer.jsx`
  - `client/src/components/PostCard.jsx`

### 4. Regular users perform at least 3 different actions

- create post
- comment on post
- like or unlike post

Files:

- `server/src/routes/posts.js`
- `client/src/components/PostComposer.jsx`
- `client/src/components/PostCard.jsx`

### 5. Admin users perform at least 3 admin-only actions

- view all users
- view one user’s details and engagement
- view all posts including hidden posts
- edit posts
- hide or restore posts
- permanently delete posts

Files:

- `server/src/routes/admin.js`
- `client/src/pages/AdminUsers.jsx`
- `client/src/pages/AdminUserDetail.jsx`
- `client/src/pages/AdminPosts.jsx`
- `client/src/components/PostCard.jsx`

### 6. Logging for authentication, transactions, and administrative actions

- Implemented with audit logging.
- Files:
  - `server/src/utils/auditLogger.js`
  - `server/src/routes/auth.js`
  - `server/src/routes/posts.js`
  - `server/src/routes/admin.js`
  - `server/src/middleware/sessionTimeout.js`

### 7. Session timeout

- Implemented with idle timeout and absolute timeout.
- Files:
  - `server/src/middleware/sessionTimeout.js`
  - `server/src/app.js`

### 8. Error messaging with debug/non-debug behavior

- Files:
  - `server/src/utils/errorResponse.js`
  - `server/src/app.js`
  - `server/src/config/runtime.js`

### 9. HTTPS implemented

- Live HTTPS through Render deployment
- Local optional self-signed HTTPS through:
  - `server/src/startup/https.js`
  - `server/src/index.js`
  - `server/src/config/runtime.js`

## 12. Suggested Live Demo Script

### Opening

"This project is a secure community application inspired by Reddit. It allows users to register, log in, create posts, comment, and like content, while admins can moderate and manage users and posts. The backend is built with Express and PostgreSQL, and the frontend is built with React."

### Step 1. Show the database-backed design

"The project is SQL-based. The full schema is in `schemas/init.sql`. The key tables are `users`, `user_sessions`, `auth_attempts`, `posts`, `comments`, and `post_likes`."

### Step 2. Show registration and authentication

"In `server/src/routes/auth.js`, registration validates the inputs, enforces confirm-password matching, validates the uploaded profile photo, hashes the password with bcrypt, and stores the account in PostgreSQL."

"Login also happens in `server/src/routes/auth.js`. On success, the server creates a session and stores it in the `user_sessions` table using PostgreSQL-backed sessions."

### Step 3. Show user actions

"Regular users can create posts, comment on posts, and like or unlike posts. The backend implementation is in `server/src/routes/posts.js`, and the UI is in `client/src/components/PostComposer.jsx` and `client/src/components/PostCard.jsx`."

"Each post includes text plus two numeric fields: estimated read time and reference count."

### Step 4. Show admin actions

"Admins can perform several admin-only actions: they can view all users, inspect a specific user profile and engagement history, view all posts including hidden posts, edit posts, hide or restore posts, and permanently delete posts."

"Those features are implemented in `server/src/routes/admin.js` and the admin pages under `client/src/pages/`."

### Step 5. Show logging

"The project logs authentication events, transaction events, and administrative events through `server/src/utils/auditLogger.js`. This gives an audit trail for sensitive actions."

### Step 6. Show timeout and error handling

"Session timeout is implemented in `server/src/middleware/sessionTimeout.js` with both idle and absolute expiry. Controlled error handling is implemented through `server/src/utils/errorResponse.js` and the global error middleware in `server/src/app.js`."

"When debug mode is on, errors include stack traces. When debug mode is off, the user gets a generic message."

### Step 7. Show HTTPS

"The deployed app is already served over HTTPS by Render. In addition, I implemented optional self-signed HTTPS locally using `server/src/startup/https.js`."

### Step 8. Closing summary

"This project satisfies the required features: SQL persistence, text and numeric inputs, multiple user actions, multiple admin actions, logging, session timeout, controlled error messaging, and HTTPS."

## 13. Optional Notes For Questions

### Why sessions instead of JWT?

- Sessions fit well for a server-rendered or same-origin app.
- Session invalidation is simpler.
- User role and timeout handling are centralized on the server.

### Why PostgreSQL for sessions?

- It keeps the app SQL-based.
- It avoids adding another infrastructure dependency.
- It supports persistence across restarts better than in-memory sessions.

### Why file-signature validation for uploads?

- Extensions and MIME headers can be faked.
- Signature validation is stronger and better aligned with secure upload handling.

### Why generic errors in production?

- Detailed errors can leak internals.
- Generic user-facing errors are safer while request IDs still help investigation.

### Why optional self-signed HTTPS if Render already has HTTPS?

- It satisfies the HTTPS requirement locally and in self-hosted environments.
- Render’s public HTTPS is the production path.
