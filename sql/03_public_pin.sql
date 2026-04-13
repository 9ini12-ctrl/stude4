ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS public_pin CHAR(4);

ALTER TABLE teachers
  DROP CONSTRAINT IF EXISTS teachers_public_pin_check;

ALTER TABLE teachers
  ADD CONSTRAINT teachers_public_pin_check
  CHECK (public_pin IS NULL OR public_pin ~ '^[0-9]{4}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_public_pin_unique
  ON teachers(public_pin)
  WHERE public_pin IS NOT NULL;
