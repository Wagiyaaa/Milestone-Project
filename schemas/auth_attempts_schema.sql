CREATE TABLE auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  email_attempted TEXT NOT NULL,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,

  ip_address INET NOT NULL,
  user_agent TEXT NULL,

  success BOOLEAN NOT NULL,
  failure_code TEXT NULL,

  request_id UUID NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups for brute-force rules
CREATE INDEX auth_attempts_email_time_idx
  ON auth_attempts (email_attempted, attempted_at DESC);

CREATE INDEX auth_attempts_ip_time_idx
  ON auth_attempts (ip_address, attempted_at DESC);

-- Optional: speed up "failed only" counting
CREATE INDEX auth_attempts_failed_time_idx
  ON auth_attempts (attempted_at DESC)
  WHERE success = false;
