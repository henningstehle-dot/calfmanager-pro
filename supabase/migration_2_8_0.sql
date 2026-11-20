-- CalfManager Pro 2.8.0: soft archive; existing calves stay unchanged.
BEGIN;
ALTER TABLE public.calves ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.calves ADD COLUMN IF NOT EXISTS archive_reason text;
-- Extend status constraint only if it exists (older installations may use another name).
DO $$ DECLARE constraint_name text; BEGIN
 FOR constraint_name IN SELECT conname FROM pg_constraint WHERE conrelid='public.calves'::regclass AND contype='c' AND pg_get_constraintdef(oid) ~* 'CHECK.*status[[:space:]]+IN' LOOP
  EXECUTE format('ALTER TABLE public.calves DROP CONSTRAINT %I',constraint_name);
 END LOOP;
END $$;
ALTER TABLE public.calves ADD CONSTRAINT calves_status_280_check CHECK (status IN ('active','left','archived'));
CREATE INDEX IF NOT EXISTS idx_calves_farm_status_280 ON public.calves(farm_id,status);
COMMIT;
