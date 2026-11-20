-- CalfManager Pro 2.5.0: Muttertier und flexible Stallboxen.
-- Vor dem Einspielen Datenbanksicherung erstellen.
ALTER TABLE public.calves ADD COLUMN IF NOT EXISTS mother_reference text;
ALTER TABLE public.calves ADD COLUMN IF NOT EXISTS box_id uuid;
CREATE TABLE IF NOT EXISTS public.farm_boxes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
 kind text NOT NULL DEFAULT 'single' CHECK(kind IN ('single','group')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,name),
 UNIQUE(farm_id,id)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='calves_box_same_farm_fk') THEN
  ALTER TABLE public.calves ADD CONSTRAINT calves_box_same_farm_fk
  FOREIGN KEY (farm_id,box_id) REFERENCES public.farm_boxes(farm_id,id) ON DELETE SET NULL (box_id);
 END IF;
END $$;
ALTER TABLE public.farm_boxes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farm members read boxes" ON public.farm_boxes;
DROP POLICY IF EXISTS "Farm owners manage boxes" ON public.farm_boxes;
-- Reuse the membership table for farm-scoped access. Check membership table naming against your existing schema.
CREATE POLICY "Farm members read boxes" ON public.farm_boxes FOR SELECT TO authenticated
 USING (public.is_farm_member(farm_id));
CREATE POLICY "Farm owners manage boxes" ON public.farm_boxes FOR ALL TO authenticated
 USING (public.is_farm_owner(farm_id))
 WITH CHECK (public.is_farm_owner(farm_id));

-- Die Ampelfarbe wird ausschließlich manuell gesetzt; keine Trinkmengen-Automatik.
ALTER TABLE public.calves ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'green'
 CHECK (health_status IN ('green','yellow','red'));
