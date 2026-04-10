CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor', 'reader')),
  gender TEXT CHECK (gender IN ('male', 'female') OR gender IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  supervisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reader_id UUID REFERENCES users(id) ON DELETE SET NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  is_graduated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teachers_supervisor_id ON teachers(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_teachers_reader_id ON teachers(reader_id);
CREATE INDEX IF NOT EXISTS idx_teachers_gender ON teachers(gender);

CREATE TABLE IF NOT EXISTS recitations (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 30),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, part_number)
);

CREATE TABLE IF NOT EXISTS attendance (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 12),
  present BOOLEAN NOT NULL DEFAULT FALSE,
  pre_test BOOLEAN NOT NULL DEFAULT FALSE,
  post_test BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, day)
);

CREATE TABLE IF NOT EXISTS tasks (
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  task_number INTEGER NOT NULL CHECK (task_number BETWEEN 1 AND 8),
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, task_number)
);

CREATE TABLE IF NOT EXISTS final_exam (
  teacher_id UUID PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
