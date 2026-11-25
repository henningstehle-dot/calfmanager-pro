-- Nur für lokale Tests. Ergänzt die im Repository fehlenden produktiven 3.x-Definitionen
-- anhand der von der freigegebenen App genutzten Spalten und RPC-Signaturen.
-- PostgreSQL stellt den alten IN-Check als ANY dar. Der in 2.8.0 angelegte
-- Archiv-Check gilt auch für Testkälber aus dem gealterten Basisschema.
alter table public.calves drop constraint if exists calves_status_check;
alter table public.calf_events
  add column task_status text default 'open' check (task_status in ('open','progress','done')),
  add column priority text default 'normal' check (priority in ('low','normal','urgent')),
  add column due_date date,
  add column completed_at timestamptz,
  add column completed_by uuid;
create table public.farm_treatment_templates_320 (id uuid primary key);
create table public.farm_treatment_settings_320 (farm_id uuid primary key);
grant select, insert, update, delete on public.calf_events, public.calves to authenticated;

create function public.complete_farm_task_320(p_farm_id uuid, p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.calf_events%rowtype;
begin
  if not public.is_farm_member(p_farm_id) then raise exception 'Kein Zugriff'; end if;
  select * into strict v_event from public.calf_events where id = p_event_id and farm_id = p_farm_id;
  if v_event.details like '[BEHANDLUNG:%' then
    insert into public.calf_treatments(farm_id, calf_id, medicine_name, started_on, ended_on)
    values (p_farm_id, v_event.calf_id, 'Testbehandlung', current_date, current_date);
  end if;
  update public.calf_events set task_status = 'done', completed_at = clock_timestamp(), completed_by = auth.uid()
  where id = p_event_id and farm_id = p_farm_id;
end;
$$;
