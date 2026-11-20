-- CalfManager Pro 2.6.0: Betriebliche Tränkekurven. Vorher Sicherung erstellen.
-- Keine Änderung an bestehenden Kälbern oder an der Gesundheitsampel.
CREATE TABLE IF NOT EXISTS public.farm_milk_curves (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
 breed text NOT NULL CHECK (breed IN ('Fleckvieh','Schwarzbunt','Braunvieh','Jersey')),
 sex text NOT NULL CHECK (sex IN ('female','male')),
 milk_type text NOT NULL DEFAULT 'whole' CHECK (milk_type IN ('whole','mat')),
 grams_per_liter numeric NOT NULL DEFAULT 140 CHECK (grams_per_liter BETWEEN 50 AND 300),
 points jsonb NOT NULL CHECK (jsonb_typeof(points)='array' AND jsonb_array_length(points)>=2),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(farm_id,breed,sex)
);
ALTER TABLE public.farm_milk_curves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Farm members read milk curves" ON public.farm_milk_curves;
DROP POLICY IF EXISTS "Farm owners manage milk curves" ON public.farm_milk_curves;
CREATE POLICY "Farm members read milk curves" ON public.farm_milk_curves FOR SELECT TO authenticated
 USING (public.is_farm_member(farm_id));
CREATE POLICY "Farm owners manage milk curves" ON public.farm_milk_curves FOR ALL TO authenticated
 USING (public.is_farm_owner(farm_id)) WITH CHECK (public.is_farm_owner(farm_id));
