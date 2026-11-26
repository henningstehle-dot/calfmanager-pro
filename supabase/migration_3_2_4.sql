-- Optional birth weight; existing measurements and RLS remain unchanged.
begin;
alter table public.calves add column if not exists birth_weight_kg numeric(8,2) check (birth_weight_kg > 0 and birth_weight_kg <= 2000);
commit;
