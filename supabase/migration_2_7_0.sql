-- CalfManager Pro 2.7.0: Gesundheitsverwaltung, betriebsgebunden und RLS-geschützt.
-- Vor Ausführung Datenbanksicherung erstellen. Einmalig im Supabase SQL Editor ausführen.
BEGIN;
CREATE TABLE IF NOT EXISTS public.farm_medicines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 name text NOT NULL, kind text NOT NULL DEFAULT 'medicine' CHECK(kind IN ('medicine','vaccine')),
 active_ingredient text, manufacturer text, dosage_form text, administration_route text,
 default_dose numeric, dose_unit text, withdrawal_milk_days integer, withdrawal_meat_days integer,
 batch_number text, expires_on date, notes text, archived boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(farm_id,id)
);
CREATE TABLE IF NOT EXISTS public.calf_health_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 calf_id uuid NOT NULL, onset_date date NOT NULL, symptoms text, diagnosis text, veterinarian text,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_treatment','recovered','closed')),
 resolved_on date, notes text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,id), FOREIGN KEY(calf_id,farm_id) REFERENCES public.calves(id,farm_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.calf_treatments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 calf_id uuid NOT NULL, health_case_id uuid, medicine_id uuid,
 medicine_name text NOT NULL, active_ingredient text, manufacturer text, batch_number text,
 dosage_form text, administration_route text, dose numeric, dose_unit text, veterinarian text,
 started_on date NOT NULL, ended_on date NOT NULL CHECK(ended_on >= started_on),
 withdrawal_milk_days integer, withdrawal_meat_days integer,
 milk_withdrawal_until date GENERATED ALWAYS AS (ended_on + withdrawal_milk_days) STORED,
 meat_withdrawal_until date GENERATED ALWAYS AS (ended_on + withdrawal_meat_days) STORED,
 notes text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(calf_id,farm_id) REFERENCES public.calves(id,farm_id) ON DELETE CASCADE,
 FOREIGN KEY(farm_id,health_case_id) REFERENCES public.calf_health_cases(farm_id,id),
 FOREIGN KEY(farm_id,medicine_id) REFERENCES public.farm_medicines(farm_id,id)
);
CREATE TABLE IF NOT EXISTS public.calf_vaccinations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 calf_id uuid NOT NULL, medicine_id uuid, vaccine_name text NOT NULL, manufacturer text, batch_number text,
 administered_on date NOT NULL, next_due_on date, dose numeric, dose_unit text,
 administration_route text, veterinarian text, notes text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(calf_id,farm_id) REFERENCES public.calves(id,farm_id) ON DELETE CASCADE,
 FOREIGN KEY(farm_id,medicine_id) REFERENCES public.farm_medicines(farm_id,id)
);
CREATE TABLE IF NOT EXISTS public.calf_followups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 calf_id uuid NOT NULL, health_case_id uuid, due_on date NOT NULL, title text NOT NULL, notes text,
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','done','cancelled')),
 completed_on date, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(calf_id,farm_id) REFERENCES public.calves(id,farm_id) ON DELETE CASCADE,
 FOREIGN KEY(farm_id,health_case_id) REFERENCES public.calf_health_cases(farm_id,id)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['farm_medicines','calf_health_cases','calf_treatments','calf_vaccinations','calf_followups'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','health_read_' || t,t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','health_insert_' || t,t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','health_update_' || t,t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','health_delete_' || t,t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_farm_member(farm_id))','health_read_' || t,t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_farm_member(farm_id))','health_insert_' || t,t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_farm_member(farm_id)) WITH CHECK (public.is_farm_member(farm_id))','health_update_' || t,t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_farm_owner(farm_id))','health_delete_' || t,t);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS idx_health_cases_farm_calf ON public.calf_health_cases(farm_id,calf_id);
CREATE INDEX IF NOT EXISTS idx_treatments_farm_calf ON public.calf_treatments(farm_id,calf_id);
CREATE INDEX IF NOT EXISTS idx_vaccinations_farm_calf ON public.calf_vaccinations(farm_id,calf_id);
CREATE INDEX IF NOT EXISTS idx_followups_farm_due ON public.calf_followups(farm_id,due_on);
COMMIT;
