CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email citext NOT NULL UNIQUE,
  phone_e164 text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  profile_photo_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phone_e164_format_check CHECK (phone_e164 ~ '^\+[1-9]\d{1,14}$')
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
  ON public.user_sessions (expire);

CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_attempted citext NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address inet NOT NULL,
  user_agent text,
  success boolean NOT NULL,
  failure_code text,
  request_id uuid,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_email_time_idx
  ON public.auth_attempts (email_attempted, attempted_at DESC);

CREATE INDEX IF NOT EXISTS auth_attempts_failed_email_time_idx
  ON public.auth_attempts (email_attempted, attempted_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS auth_attempts_failed_ip_time_idx
  ON public.auth_attempts (ip_address, attempted_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS auth_attempts_failed_time_idx
  ON public.auth_attempts (attempted_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS auth_attempts_ip_time_idx
  ON public.auth_attempts (ip_address, attempted_at DESC);
