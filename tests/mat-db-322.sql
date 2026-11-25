-- Nach Fixture und 3.2.2-Migration auf der lokalen Testdatenbank ausführen.
begin;

do $$
begin
  if not exists (
    select 1 from public.farm_mat_settings
    where farm_id = 'a2200000-0000-4000-8000-000000000001'
      and concentration_basis = 'prepared' and grams_per_liter = 150
      and reference_water_liters is null and reference_prepared_liters is null
  ) then
    raise exception 'Eindeutige MAT-Konzentration fehlt oder Ausbeute wurde erfunden';
  end if;
  if exists (
    select 1 from public.farm_mat_settings where farm_id in (
      'a2200000-0000-4000-8000-000000000002',
      'a2200000-0000-4000-8000-000000000003'
    )
  ) then
    raise exception 'Widersprüchliche MAT-Angaben oder Vollmilchwerte wurden übernommen';
  end if;
  if has_table_privilege('anon', 'public.farm_mat_settings', 'select') then
    raise exception 'Nicht angemeldete Benutzer haben Lesezugriff';
  end if;
end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('a2200000-0000-4000-8000-000000000011', 'mat-owner@example.test', '{}'),
  ('a2200000-0000-4000-8000-000000000012', 'mat-employee@example.test', '{}'),
  ('a2200000-0000-4000-8000-000000000013', 'mat-outside-owner@example.test', '{}');

insert into public.farm_members (farm_id, user_id, role) values
  ('a2200000-0000-4000-8000-000000000001', 'a2200000-0000-4000-8000-000000000011', 'owner'),
  ('a2200000-0000-4000-8000-000000000001', 'a2200000-0000-4000-8000-000000000012', 'employee'),
  ('a2200000-0000-4000-8000-000000000002', 'a2200000-0000-4000-8000-000000000013', 'owner'),
  ('a2200000-0000-4000-8000-000000000003', 'a2200000-0000-4000-8000-000000000012', 'employee');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2200000-0000-4000-8000-000000000013', true);
insert into public.farm_mat_settings (farm_id, concentration_basis, grams_per_liter, reference_water_liters, reference_prepared_liters)
values ('a2200000-0000-4000-8000-000000000002', 'prepared', 170, 8, 9);

select set_config('request.jwt.claim.sub', 'a2200000-0000-4000-8000-000000000011', true);
insert into public.farm_mat_settings (farm_id, concentration_basis, grams_per_liter, reference_water_liters, reference_prepared_liters)
values ('a2200000-0000-4000-8000-000000000001', 'water', 160, 9, 10)
on conflict (farm_id) do update set
  farm_id = excluded.farm_id,
  concentration_basis = excluded.concentration_basis,
  grams_per_liter = excluded.grams_per_liter,
  reference_water_liters = excluded.reference_water_liters,
  reference_prepared_liters = excluded.reference_prepared_liters;

do $$
declare
  own_farm constant uuid := 'a2200000-0000-4000-8000-000000000001';
  outside_farm constant uuid := 'a2200000-0000-4000-8000-000000000002';
begin
  if not exists (
    select 1 from public.farm_mat_settings
    where farm_id = own_farm and concentration_basis = 'water' and grams_per_liter = 160
      and reference_water_liters = 9 and reference_prepared_liters = 10
  ) then
    raise exception 'MAT-Angaben des Betriebsinhabers wurden nicht gespeichert';
  end if;
  if exists (select 1 from public.farm_mat_settings where farm_id = outside_farm) then
    raise exception 'Betriebsinhaber kann einen fremden Betrieb lesen';
  end if;
  update public.farm_mat_settings set grams_per_liter = 190 where farm_id = outside_farm;
  if found then raise exception 'Betriebsinhaber kann einen fremden Betrieb ändern'; end if;

  begin
    update public.farm_mat_settings set reference_prepared_liters = null where farm_id = own_farm;
    raise exception 'Unvollständiges Herstellerbeispiel wurde gespeichert';
  exception when check_violation then null;
  end;
  begin
    update public.farm_mat_settings set reference_water_liters = 11 where farm_id = own_farm;
    raise exception 'Wassermenge über fertiger Tränkemenge wurde gespeichert';
  exception when check_violation then null;
  end;
  begin
    update public.farm_mat_settings set reference_prepared_liters = 'Infinity'::numeric where farm_id = own_farm;
    raise exception 'Unendliche Tränkemenge wurde gespeichert';
  exception when check_violation then null;
  end;
  begin
    update public.farm_mat_settings set grams_per_liter = 301 where farm_id = own_farm;
    raise exception 'Unplausible Konzentration wurde gespeichert';
  exception when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'a2200000-0000-4000-8000-000000000012', true);
do $$
begin
  if not exists (select 1 from public.farm_mat_settings where farm_id = 'a2200000-0000-4000-8000-000000000001') then
    raise exception 'Mitarbeiter kann MAT-Angaben seines Betriebs nicht lesen';
  end if;
  if exists (select 1 from public.farm_mat_settings where farm_id = 'a2200000-0000-4000-8000-000000000002') then
    raise exception 'Mitarbeiter kann MAT-Angaben eines fremden Betriebs lesen';
  end if;
  update public.farm_mat_settings set grams_per_liter = 190 where farm_id = 'a2200000-0000-4000-8000-000000000001';
  if found then raise exception 'Mitarbeiter kann bestehende MAT-Angaben ändern'; end if;
  begin
    insert into public.farm_mat_settings (farm_id, concentration_basis, grams_per_liter)
    values ('a2200000-0000-4000-8000-000000000003', 'prepared', 150);
    raise exception 'Mitarbeiter kann neue MAT-Angaben anlegen';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
