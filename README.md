# CSSECDEV milestone project (PERN)

Security-focused milestone app using Postgres, Express, React (Vite), and Node.

## Project structure

- `client/` React app (Vite)
- `server/` Express API
- `schemas/` Postgres schema (`init.sql`)

## Features

Auth and sessions
- Register: full name, email, phone (E.164), password, required profile photo
- Login: email + password (JSON)
- Session-based auth using an HTTP-only cookie (`sid`)
- Session storage in Postgres (`user_sessions`)

Admin
- `GET /admin/users` admin-only
- Returns 200 for admin users and 403 for normal users

Security controls
- Password hashing with bcrypt
- Brute-force attempt logging in `auth_attempts`
- Rate limiting based on email + IP (server-side)
- File upload validation using signature detection (JPEG/PNG only)
- Upload size limit (default 5MB)
- Controlled error messaging with request IDs

## Prerequisites

- Node.js 18+ (recommended 20)
- Postgres 14+
- `psql` CLI (bundled with Postgres)

Optional
- pgAdmin or DBeaver for database inspection

## Local development setup

### Install dependencies

From the repo root:

```bash
npm install --prefix server
npm install --prefix client


Create a local Postgres database

Example DB name: cssecdev_local

psql -U postgres -c "CREATE DATABASE cssecdev_local;"

Initialize schema

From the repo root:

psql -U postgres -d cssecdev_local -f schemas/init.sql


Sanity check:

psql -U postgres -d cssecdev_local -c "\dt"


Expected tables:

users

auth_attempts

user_sessions

Environment variables

Create server/.env (do not commit this file):

NODE_ENV=development
PORT=5000

DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/cssecdev_local

SESSION_SECRET=change_this_to_a_long_random_string

UPLOAD_MAX_MB=5
# Optional: override where uploads are saved locally
# If not set, uploads default to server/uploads
# UPLOAD_DIR=E:\CSSECDEV\Project\uploads

Running locally
Start the backend

From the repo root:

npm run dev --prefix server


Backend runs on:

http://localhost:5000

Health check:

GET http://localhost:5000/health

Start the frontend

From the repo root:

npm run dev --prefix client


Frontend runs on:

http://localhost:5173

Vite proxy (required for sessions and uploads in development)

Ensure client/vite.config.js proxies the API and uploads:

server: {
  proxy: {
    "/auth": { target: "http://localhost:5000", changeOrigin: true },
    "/admin": { target: "http://localhost:5000", changeOrigin: true },
    "/uploads": { target: "http://localhost:5000", changeOrigin: true }
  }
}

Running locally
Start the backend

From the repo root:

npm run dev --prefix server


Backend runs on:

http://localhost:5000

Health check:

GET http://localhost:5000/health

Start the frontend

From the repo root:

npm run dev --prefix client


Frontend runs on:

http://localhost:5173

Vite proxy (required for sessions and uploads in development)

Ensure client/vite.config.js proxies the API and uploads:

server: {
  proxy: {
    "/auth": { target: "http://localhost:5000", changeOrigin: true },
    "/admin": { target: "http://localhost:5000", changeOrigin: true },
    "/uploads": { target: "http://localhost:5000", changeOrigin: true }
  }
}
