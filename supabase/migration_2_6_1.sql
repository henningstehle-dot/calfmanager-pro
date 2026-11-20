-- CalfManager Pro 2.6.1 – benannte Tränkekurven und Zuordnung zu Kälbern.
-- Nach erfolgreicher Sicherung einmalig im Supabase SQL Editor ausführen.
BEGIN;
ALTER TABLE public.farm_milk_curves ADD COLUMN IF NOT EXISTS name text;
UPDATE public.farm_milk_curves
SET name = breed || ' – ' || CASE WHEN sex = 'female' THEN 'Weiblich' ELSE 'Männlich' END
WHERE name IS NULL OR btrim(name) = '';
ALTER TABLE public.farm_milk_curves ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.farm_milk_curves DROP CONSTRAINT IF EXISTS farm_milk_curves_farm_id_breed_sex_key;
ALTER TABLE public.farm_milk_curves ADD CONSTRAINT farm_milk_curves_farm_id_id_key UNIQUE (farm_id,id);
ALTER TABLE public.calves ADD COLUMN IF NOT EXISTS milk_curve_id uuid;
ALTER TABLE public.calves DROP CONSTRAINT IF EXISTS calves_milk_curve_same_farm_fk;
ALTER TABLE public.calves ADD CONSTRAINT calves_milk_curve_same_farm_fk
 FOREIGN KEY (farm_id,milk_curve_id) REFERENCES public.farm_milk_curves(farm_id,id) ON DELETE SET NULL (milk_curve_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_milk_curves TO authenticated;
-- RLS bleibt aktiv und beschränkt Lesen auf Betriebsmitglieder und Schreiben auf Betriebsinhaber.
COMMIT;
