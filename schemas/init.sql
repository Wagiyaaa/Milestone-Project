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

CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  image_path text,
  read_time_minutes integer NOT NULL CHECK (read_time_minutes BETWEEN 1 AND 120),
  reference_count integer NOT NULL CHECK (reference_count BETWEEN 0 AND 50),
  is_hidden boolean NOT NULL DEFAULT false,
  hidden_reason text,
  hidden_at timestamptz,
  hidden_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'topic_rating'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'reference_count'
  ) THEN
    ALTER TABLE public.posts RENAME COLUMN topic_rating TO reference_count;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'topic_rating'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'posts'
      AND column_name = 'reference_count'
  ) THEN
    UPDATE public.posts
    SET reference_count = COALESCE(reference_count, topic_rating)
    WHERE reference_count IS NULL;

    ALTER TABLE public.posts DROP COLUMN topic_rating;
  END IF;
END $$;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reference_count integer;

UPDATE public.posts
SET reference_count = 0
WHERE reference_count IS NULL;

ALTER TABLE public.posts
  ALTER COLUMN reference_count SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND conname = 'posts_topic_rating_check'
  ) THEN
    ALTER TABLE public.posts DROP CONSTRAINT posts_topic_rating_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND conname = 'posts_reference_count_check'
  ) THEN
    ALTER TABLE public.posts DROP CONSTRAINT posts_reference_count_check;
  END IF;

  ALTER TABLE public.posts
    ADD CONSTRAINT posts_reference_count_check
    CHECK (reference_count BETWEEN 0 AND 50);
END $$;

CREATE INDEX IF NOT EXISTS posts_author_created_idx
  ON public.posts (author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS posts_visibility_created_idx
  ON public.posts (is_hidden, created_at DESC);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON public.comments (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS comments_author_created_idx
  ON public.comments (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_likes_user_created_idx
  ON public.post_likes (user_id, created_at DESC);
