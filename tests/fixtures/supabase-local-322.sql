-- Nur für lokale Tests. Ergänzt die im Repository fehlenden produktiven 3.x-Definitionen
-- anhand der von der freigegebenen App genutzten Spalten und RPC-Signaturen.
-- PostgreSQL stellt den alten IN-Check als ANY dar. Der in 2.8.0 angelegte
-- Archiv-Check gilt auch für Testkälber aus dem gealterten Basisschema.
alter table public.calves drop constraint if exists calves_status_check;
alter table public.calf_events
  add column task_status text default 'open' check (task_status in ('open','progress','done')),
  add column priority text default 'normal' check (priority in ('low','normal','urgent')),
  add column due_date date,
  add column assigned_to uuid references auth.users(id) on delete set null;
create table public.farm_treatment_templates_320 (
  id uuid primary key, farm_id uuid, name text, days integer, times_per_day integer, is_halocur boolean
);
create table public.farm_treatment_settings_320 (farm_id uuid primary key);
create table public.calf_treatment_plans_320 (
  id uuid primary key, farm_id uuid, calf_id uuid, template_id uuid, start_date date, created_by uuid
);
create table public.calf_task_completions_320 (
  task_id uuid primary key, farm_id uuid, completed_at timestamptz default now(), completed_by uuid
);
create table public.calf_treatment_administrations_320 (
  farm_id uuid, plan_id uuid, task_id uuid primary key, calf_id uuid,
  administered_at timestamptz default now(), administered_by uuid
);
grant select, insert, update, delete on public.calf_events, public.calves to authenticated;

create function public.complete_farm_task_320(p_farm_id uuid, p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.calf_events%rowtype;
begin
  if not public.is_farm_member(p_farm_id) then raise exception 'Kein Zugriff'; end if;
  select * into strict v_event from public.calf_events where id = p_event_id and farm_id = p_farm_id;
  if v_event.details like '[BEHANDLUNG:%' then
    insert into public.calf_treatment_administrations_320(farm_id, plan_id, task_id, calf_id, administered_by)
    values (p_farm_id, substring(v_event.details from 13 for 36)::uuid, p_event_id, v_event.calf_id, auth.uid());
  end if;
  insert into public.calf_task_completions_320(task_id, farm_id, completed_by)
  values (p_event_id, p_farm_id, auth.uid());
  update public.calf_events set task_status = 'done'
  where id = p_event_id and farm_id = p_farm_id;
end;
$$;

-- Nachbildung der bereits in 3.2.2 verwendeten Fütterungstabelle für lokale Tests.
create table public.calf_feeding_rounds (
  farm_id uuid not null,
  calf_id uuid not null,
  feeding_date date not null,
  round text not null check (round in ('morning', 'noon', 'evening')),
  status text not null check (status in ('green', 'yellow', 'red')),
  updated_at timestamptz not null default now(),
  primary key (farm_id, calf_id, feeding_date, round),
  foreign key (calf_id, farm_id) references public.calves(id, farm_id)
);
alter table public.calf_feeding_rounds enable row level security;
create policy feeding_rounds_member on public.calf_feeding_rounds to authenticated
  using (public.is_farm_member(farm_id)) with check (public.is_farm_member(farm_id));
grant select, insert, update on public.calf_feeding_rounds to authenticated;
