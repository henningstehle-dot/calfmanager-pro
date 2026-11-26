-- CalfManager Pro 3.2.2
-- Für die laufende 3.2.1-Datenbank. Vorher sichern und zuerst auf einer Kopie prüfen.
-- Diese Datei vollständig als Datenbankadministrator ausführen, bevor die App aktualisiert wird.
begin;

-- Die bis 2.8.0 eingecheckten SQL-Dateien bilden allein keine 3.2.1-Datenbank.
do $prerequisites$
begin
  if to_regprocedure('public.complete_farm_task_320(uuid,uuid)') is null
    or to_regclass('public.farm_treatment_templates_320') is null
    or to_regclass('public.farm_treatment_settings_320') is null
    or to_regclass('public.calf_task_completions_320') is null
    or to_regclass('public.calf_treatment_administrations_320') is null
    or to_regclass('public.calf_treatment_plans_320') is null
    or to_regclass('public.farm_growth_settings') is null
    or to_regclass('public.calf_followups') is null
    or to_regclass('public.calf_treatments') is null
    or to_regclass('public.calf_vaccinations') is null
    or to_regclass('public.farm_milk_curves') is null
    or not exists (
      select 1 from pg_attribute
      where attrelid = 'public.calf_events'::regclass and attname = 'task_status' and not attisdropped
    )
    or not exists (
      select 1 from pg_attribute
      where attrelid = 'public.calf_events'::regclass and attname = 'due_date' and not attisdropped
    )
  then
    raise exception 'CalfManager Pro 3.2.2 benötigt das vollständige Datenbankschema der laufenden Version 3.2.1.';
  end if;
end
$prerequisites$;

-- Die App verwendet diese Tabelle bereits für die Mindestzunahme. Der
-- 3.2.1-Stand enthält die Mitglieder-/Inhaber-RLS, aber keine DML-Grants.
grant select, insert, update on public.farm_growth_settings to authenticated;

create table public.farm_task_templates_322 (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 2000),
  recurring boolean not null default false,
  times_per_day integer not null default 1 check (times_per_day between 1 and 24),
  duration_days integer check (duration_days between 1 and 3660),
  active boolean not null default true,
  unique (farm_id, id),
  check (recurring or (times_per_day = 1 and coalesce(duration_days, 1) = 1))
);

alter table public.farm_task_templates_322 enable row level security;
create policy "task templates member read" on public.farm_task_templates_322 for select
  to authenticated using (public.is_farm_member(farm_id));
create policy "task templates owner insert" on public.farm_task_templates_322 for insert
  to authenticated with check (public.is_farm_owner(farm_id));
create policy "task templates owner update" on public.farm_task_templates_322 for update
  to authenticated using (public.is_farm_owner(farm_id)) with check (public.is_farm_owner(farm_id));
revoke all on public.farm_task_templates_322 from public, anon, authenticated, service_role;
grant select on public.farm_task_templates_322 to authenticated;
grant insert (farm_id, name, description, recurring, times_per_day, duration_days, active)
  on public.farm_task_templates_322 to authenticated;
grant update (name, description, recurring, times_per_day, duration_days, active)
  on public.farm_task_templates_322 to authenticated;

-- Die Aufgabe wird je Kalb zugeordnet. Nur tatsächliche Durchführungen werden als
-- calf_events gespeichert. Fällige Durchführungen ergeben sich aus dem Kalender.
create table public.calf_task_assignments_322 (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete restrict,
  calf_id uuid not null,
  group_id uuid not null,
  template_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  notes text check (char_length(notes) <= 2000),
  recurring boolean not null,
  times_per_day integer not null check (times_per_day between 1 and 24),
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  ended_at timestamptz,
  ended_by uuid,
  unique (farm_id, group_id, calf_id),
  unique (farm_id, calf_id, id),
  foreign key (calf_id, farm_id) references public.calves(id, farm_id) on delete restrict,
  foreign key (farm_id, template_id) references public.farm_task_templates_322(farm_id, id) on delete restrict,
  check (ends_on is null or ends_on between starts_on and starts_on + 3659),
  check (recurring or (times_per_day = 1 and ends_on is not distinct from starts_on)),
  check ((ended_at is null) = (ended_by is null))
);
alter table public.calf_task_assignments_322 enable row level security;
-- Direkter Zugriff bleibt gesperrt. Alle Zugriffe laufen über betriebsgeprüfte RPCs.
revoke all on public.calf_task_assignments_322 from public, anon, authenticated, service_role;
create index calf_task_assignments_322_open
  on public.calf_task_assignments_322 (farm_id, starts_on, calf_id) where ended_at is null;

alter table public.calf_events
  add column task_assignment_id_322 uuid,
  add column task_occurrence_322 integer,
  add column task_completed_at_322 timestamptz,
  add column task_completed_by_322 uuid,
  add column task_completed_by_name_322 text,
  add column task_ended_at_322 timestamptz,
  add column task_ended_by_322 uuid,
  add constraint calf_events_assignment_322_fk
    foreign key (farm_id, calf_id, task_assignment_id_322)
      references public.calf_task_assignments_322(farm_id, calf_id, id) on delete restrict,
  add constraint calf_events_assignment_322_consistency check (
    (task_assignment_id_322 is null and task_occurrence_322 is null)
    or (task_assignment_id_322 is not null and task_occurrence_322 is not null
      and task_occurrence_322 between 1 and 24 and due_date is not null
      and kind = 'task' and task_status is not distinct from 'done')
  ),
  add constraint calf_events_ending_322_consistency
    check ((task_ended_at_322 is null) = (task_ended_by_322 is null));

create unique index calf_events_unique_task_occurrence_322
  on public.calf_events (task_assignment_id_322, due_date, task_occurrence_322)
  where task_assignment_id_322 is not null;
create index calf_events_legacy_tasks_322
  on public.calf_events (farm_id, calf_id, due_date)
  where kind = 'task' and task_assignment_id_322 is null;
create index calf_events_completions_322
  on public.calf_events (farm_id, task_completed_at_322)
  where kind = 'task' and task_status = 'done';

alter table public.calf_followups
  add column task_completed_at_322 timestamptz,
  add column task_completed_by_322 uuid,
  add column task_completed_by_name_322 text;

create function public._task_actor_name_322(p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    nullif(concat_ws(' ',
      nullif(btrim(u.raw_user_meta_data->>'first_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'last_name'), '')
    ), ''),
    u.email::text
  )
  from auth.users u
  where u.id = p_user_id
$$;

-- schedule_treatment_320 schreibt die Plan-ID in einen exakten Marker.
create function public._legacy_treatment_group_322(p_details text) returns text
language sql immutable set search_path = '' as $$
  select lower(substring(p_details from '^\[BEHANDLUNG:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\]'))
$$;

create function public._guard_calf_task_events_322() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'task' and (
      old.task_status = 'done' or old.details like '[BEHANDLUNG:%' or old.task_ended_at_322 is not null
    ) then
      raise exception 'Aufgaben- und Behandlungshistorie darf nicht gelöscht werden.' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.kind = 'task' then
    -- Der bestehende Auth-Fremdschlüssel räumt nur die optionale
    -- Zuweisung auf. Durchführung und Auditdaten bleiben erhalten.
    if pg_trigger_depth() > 1 and old.assigned_to is not null and new.assigned_to is null
      and (to_jsonb(new) - 'assigned_to') = (to_jsonb(old) - 'assigned_to')
    then
      return new;
    end if;
    if current_user in ('authenticated','anon') and old.details like '[BEHANDLUNG:%' and new is distinct from old then
      raise exception 'Diese Behandlung kann nur über die Aufgabenfunktion geändert werden.' using errcode = '42501';
    end if;
    if old.task_status = 'done' and (
      new.kind is distinct from old.kind or new.task_status is distinct from old.task_status
      or new.id is distinct from old.id or new.calf_id is distinct from old.calf_id
      or new.farm_id is distinct from old.farm_id or new.due_date is distinct from old.due_date
      or new.task_assignment_id_322 is distinct from old.task_assignment_id_322
      or new.task_occurrence_322 is distinct from old.task_occurrence_322
      or new.task_completed_at_322 is distinct from old.task_completed_at_322
      or new.task_completed_by_322 is distinct from old.task_completed_by_322
      or new.task_completed_by_name_322 is distinct from old.task_completed_by_name_322
      or (current_user in ('authenticated','anon') and new is distinct from old)
    ) then
      raise exception 'Eine dokumentierte Durchführung bleibt erhalten.' using errcode = '23514';
    end if;

    if old.task_ended_at_322 is not null and new is distinct from old then
      raise exception 'Diese Aufgabe ist beendet.' using errcode = '23514';
    end if;
  end if;

  if new.kind = 'task' then
    if current_user in ('authenticated','anon') and (
      new.task_assignment_id_322 is not null or new.task_occurrence_322 is not null
      or new.task_ended_at_322 is not null or new.task_ended_by_322 is not null
      or (new.details like '[BEHANDLUNG:%' and new.task_status = 'done')
    ) then
      raise exception 'Diese Aufgabe kann nur über die Aufgabenfunktion geändert werden.' using errcode = '42501';
    end if;

    if new.task_assignment_id_322 is not null and tg_op = 'INSERT' and auth.uid() is not null then
      new.task_completed_at_322 := clock_timestamp();
      new.event_date := (new.task_completed_at_322 at time zone 'Europe/Berlin')::date;
      new.task_completed_by_322 := auth.uid();
      new.task_completed_by_name_322 := public._task_actor_name_322(auth.uid());
    elsif tg_op = 'INSERT' or old.task_status is distinct from 'done' then
      -- Altaufgaben behalten die kanonische 3.2.0-Erledigungstabelle.
      new.task_completed_at_322 := null;
      new.task_completed_by_322 := null;
      new.task_completed_by_name_322 := null;
    end if;
  end if;

  return new;
end;
$$;
create trigger protect_calf_task_events_322
  before insert or update or delete on public.calf_events
  for each row execute function public._guard_calf_task_events_322();

create function public._guard_followup_history_322() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'done' then
      raise exception 'Dokumentierte Nachkontrollen dürfen nicht gelöscht werden.' using errcode = '23514';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'done' then
    if new.status is distinct from old.status or new.id is distinct from old.id
      or new.farm_id is distinct from old.farm_id or new.calf_id is distinct from old.calf_id
      or new.completed_on is distinct from old.completed_on
      or new.task_completed_at_322 is distinct from old.task_completed_at_322
      or new.task_completed_by_322 is distinct from old.task_completed_by_322
      or new.task_completed_by_name_322 is distinct from old.task_completed_by_name_322
    then
      raise exception 'Eine dokumentierte Nachkontrolle bleibt erhalten.' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.status = 'done' and auth.uid() is not null then
    new.task_completed_at_322 := clock_timestamp();
    new.completed_on := (new.task_completed_at_322 at time zone 'Europe/Berlin')::date;
    new.task_completed_by_322 := auth.uid();
    new.task_completed_by_name_322 := public._task_actor_name_322(auth.uid());
  else
    new.task_completed_at_322 := null;
    new.task_completed_by_322 := null;
    new.task_completed_by_name_322 := null;
  end if;
  return new;
end;
$$;
create trigger protect_followup_history_322
  before insert or update or delete on public.calf_followups
  for each row execute function public._guard_followup_history_322();

create function public._keep_medical_history_322() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Dokumentierte medizinische Historie darf nicht gelöscht werden.' using errcode = '23514';
end;
$$;
create trigger keep_calf_treatments_322 before delete on public.calf_treatments
  for each row execute function public._keep_medical_history_322();
create trigger keep_calf_vaccinations_322 before delete on public.calf_vaccinations
  for each row execute function public._keep_medical_history_322();

-- TRUNCATE löst keine Zeilen-Trigger aus. Die geerbten Wartungsrechte bleiben
-- bestehen. Die Anwendungsrollen benötigen kein TRUNCATE für die Historie.
revoke truncate on public.calf_events, public.calf_followups, public.calf_treatments,
  public.calf_vaccinations, public.calf_treatment_plans_320,
  public.calf_treatment_administrations_320, public.calf_task_completions_320
from public, anon, authenticated, service_role;

create function public.create_farm_tasks_322(
  p_farm_id uuid, p_calf_ids uuid[], p_template_id uuid, p_name text,
  p_recurring boolean, p_times_per_day integer, p_start_date date, p_end_date date,
  p_notes text, p_request_id uuid default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_today date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  v_group_id uuid := coalesce(p_request_id, gen_random_uuid());
  v_name text := btrim(p_name);
  v_notes text := nullif(btrim(p_notes), '');
  v_end date := case when p_recurring then p_end_date else p_start_date end;
  v_ids uuid[];
  v_existing_ids uuid[];
  v_count integer;
begin
  if v_actor is null or not public.is_farm_member(p_farm_id) then
    raise exception 'Kein Zugriff auf diesen Betrieb.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_calf_ids), 0) = 0 or array_position(p_calf_ids, null::uuid) is not null then
    raise exception 'Bitte mindestens ein Kalb auswählen.' using errcode = '22023';
  end if;
  if coalesce(char_length(v_name), 0) not between 1 and 120
    or coalesce(char_length(v_notes), 0) > 2000
    or coalesce(p_times_per_day, 0) not between 1 and 24 or p_recurring is null
    or p_start_date is null or p_start_date not between v_today - 3660 and v_today + 3660
    or (not p_recurring and (p_times_per_day <> 1 or (p_end_date is not null and p_end_date <> p_start_date)))
    or (v_end is not null and v_end not between p_start_date and p_start_date + 3659)
  then
    raise exception 'Bitte Bezeichnung, Beginn, Häufigkeit und Dauer prüfen.' using errcode = '22023';
  end if;

  select array_agg(distinct id order by id) into v_ids from unnest(p_calf_ids) as c(id);
  if p_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_farm_id::text || ':' || p_request_id::text, 322));
    select array_agg(a.calf_id order by a.calf_id) into v_existing_ids
    from public.calf_task_assignments_322 a where a.farm_id = p_farm_id and a.group_id = p_request_id;
    if v_existing_ids is not null then
      if v_existing_ids = v_ids and not exists (
        select 1 from public.calf_task_assignments_322 a
        where a.farm_id = p_farm_id and a.group_id = p_request_id and (
          a.created_by is distinct from v_actor or a.name is distinct from v_name
          or a.notes is distinct from v_notes or a.recurring is distinct from p_recurring
          or a.times_per_day is distinct from p_times_per_day or a.starts_on is distinct from p_start_date
          or a.ends_on is distinct from v_end or a.template_id is distinct from p_template_id
        )
      ) then return cardinality(v_existing_ids);
      end if;
      raise exception 'Diese Anfragenummer wurde bereits für eine andere Zuordnung verwendet.' using errcode = '22023';
    end if;
  end if;

  if p_template_id is not null then
    perform 1 from public.farm_task_templates_322 t
    where t.id = p_template_id and t.farm_id = p_farm_id and t.active for share;
    if not found then
      raise exception 'Die Aufgabenvorlage ist in diesem Betrieb nicht aktiv.' using errcode = '22023';
    end if;
  end if;

  -- Sperrt Statusänderungen, bis alle Zuordnungen gemeinsam gespeichert sind.
  perform c.id from public.calves c
  where c.farm_id = p_farm_id and c.id = any(v_ids) and c.status = 'active' and c.archived_at is null
  order by c.id for share;
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_ids) then
    raise exception 'Alle ausgewählten Kälber müssen aktiv sein und zu diesem Betrieb gehören.' using errcode = '22023';
  end if;

  insert into public.calf_task_assignments_322 (
    farm_id, calf_id, group_id, template_id, name, notes, recurring,
    times_per_day, starts_on, ends_on, created_by
  )
  select p_farm_id, c.id, v_group_id, p_template_id, v_name, v_notes, p_recurring,
    p_times_per_day, p_start_date, v_end, v_actor from unnest(v_ids) as c(id);
  return v_count;
end;
$$;
-- Betriebsweite Herstellerangaben für den MAT-Rechner.
create table if not exists public.farm_mat_settings (
  farm_id uuid primary key references public.farms(id) on delete cascade,
  concentration_basis text not null check (concentration_basis in ('prepared', 'water')),
  grams_per_liter numeric not null check (grams_per_liter between 50 and 300),
  reference_water_liters numeric,
  reference_prepared_liters numeric,
  constraint farm_mat_settings_valid_reference check (
    (reference_water_liters is null and reference_prepared_liters is null)
    or (
      reference_water_liters is not null and reference_prepared_liters is not null
      and reference_water_liters > 0
      and reference_water_liters <= reference_prepared_liters
      and reference_prepared_liters < 'Infinity'::numeric
    )
  )
);

alter table public.farm_mat_settings enable row level security;
drop policy if exists "mat member read" on public.farm_mat_settings;
create policy "mat member read" on public.farm_mat_settings
  for select to authenticated using (public.is_farm_member(farm_id));
drop policy if exists "mat owner insert" on public.farm_mat_settings;
create policy "mat owner insert" on public.farm_mat_settings
  for insert to authenticated with check (public.is_farm_owner(farm_id));
drop policy if exists "mat owner update" on public.farm_mat_settings;
create policy "mat owner update" on public.farm_mat_settings
  for update to authenticated using (public.is_farm_owner(farm_id))
  with check (public.is_farm_owner(farm_id));

revoke all on public.farm_mat_settings from public, anon, authenticated, service_role;
grant select, insert, update on public.farm_mat_settings to authenticated;

-- Bestehende MAT-Tränkekurven geben Gramm je Liter fertiger Mischung an.
-- Nur eine betriebsweit eindeutige Konzentration übernehmen.
insert into public.farm_mat_settings (farm_id, concentration_basis, grams_per_liter)
select farm_id, 'prepared', min(grams_per_liter)
from public.farm_milk_curves
where milk_type = 'mat'
group by farm_id
having min(grams_per_liter) = max(grams_per_liter)
  and min(grams_per_liter) between 50 and 300
on conflict (farm_id) do nothing;

create type public._task_row_322 as (
  source text, assignment_id uuid, event_id uuid, group_id text, calf_id uuid,
  ear_tag text, box_id uuid, name text, notes text, due_date date,
  occurrence integer, times_per_day integer, treatment_day integer, treatment_days integer,
  completed_at timestamptz, completed_on date, completed_by uuid, completed_by_name text,
  category text, is_treatment boolean, can_end boolean, priority text
);

-- Die 3.2.0-App verwendete calf_events für einfache und medizinische
-- Erinnerungen. Die bestehende Erledigungstabelle liefert deren Auditdaten.
create function public._legacy_task_rows_322(p_farm_id uuid, p_calf_id uuid, p_today date)
returns setof public._task_row_322
language sql stable set search_path = '' as $$
  with events as (
    select e.*, c.ear_tag, c.box_id, (c.status = 'active' and c.archived_at is null) as calf_active,
      public._legacy_treatment_group_322(e.details) as treatment_group,
      coalesce(e.due_date, e.event_date) as planned_date,
      e.details like '[BEHANDLUNG:%' as treatment,
      completion.completed_at as actual_at, completion.completed_by as actual_by
    from public.calf_events e
    join public.calves c on c.id = e.calf_id and c.farm_id = e.farm_id
    left join public.calf_task_completions_320 completion on completion.task_id = e.id and completion.farm_id = e.farm_id
    where e.farm_id = p_farm_id and (p_calf_id is null or e.calf_id = p_calf_id)
      and e.kind = 'task' and e.task_assignment_id_322 is null
  ), dated as (
    select e.*,
      min(planned_date) over (partition by calf_id, coalesce(treatment_group, id::text)) as treatment_start,
      max(planned_date) over (partition by calf_id, coalesce(treatment_group, id::text)) as treatment_end,
      count(*) over (partition by calf_id, coalesce(treatment_group, id::text), planned_date)::integer as treatment_times,
      row_number() over (partition by calf_id, coalesce(treatment_group, id::text), planned_date
        order by created_at, id)::integer as treatment_occurrence
    from events e
  )
  select 'legacy'::text, null::uuid, d.id, d.treatment_group, d.calf_id, d.ear_tag, d.box_id,
    coalesce(nullif(btrim(regexp_replace(d.details, '^\[(AUTO-GESUNDHEIT|BEHANDLUNG:[^]]*)\][[:space:]]*', '')), ''), 'Aufgabe'),
    null::text, d.planned_date,
    case when d.treatment_group is not null then coalesce(
      substring(d.details from '(?:Anwendung|Gabe)[[:space:]]+([0-9]{1,2})[[:space:]]*(?:/|von)')::integer,
      d.treatment_occurrence) end,
    case when d.treatment_group is not null then coalesce(
      substring(d.details from '(?:Anwendung|Gabe)[[:space:]]+[0-9]{1,2}[[:space:]]*(?:/|von)[[:space:]]*([0-9]{1,2})')::integer,
      d.treatment_times) end,
    case when d.treatment then coalesce(
      substring(d.details from 'Tag[[:space:]]+([0-9]{1,3})[[:space:]]*(?:/|von)')::integer,
      case when d.treatment_group is not null then d.planned_date - d.treatment_start + 1 end
    ) end,
    case when d.treatment then coalesce(
      substring(d.details from 'Tag[[:space:]]+[0-9]{1,3}[[:space:]]*(?:/|von)[[:space:]]*([0-9]{1,3})')::integer,
      case when d.treatment_group is not null then d.treatment_end - d.treatment_start + 1 end
    ) end,
    d.actual_at, (d.actual_at at time zone 'Europe/Berlin')::date,
    d.actual_by, public._task_actor_name_322(d.actual_by),
    case
      when d.task_status = 'done' then 'completed'
      when d.planned_date < p_today then 'overdue'
      when d.planned_date = p_today then 'today'
      else 'planned'
    end,
    d.treatment, d.task_status is distinct from 'done', d.priority::text
  from dated d
  where d.task_status = 'done' or (
    d.calf_active and d.task_ended_at_322 is null
    and coalesce(d.task_status::text, 'open') not in ('cancelled', 'canceled', 'ended')
  )
$$;

create function public._assignment_completed_rows_322(p_farm_id uuid, p_calf_id uuid, p_actual_on date)
returns setof public._task_row_322
language sql stable set search_path = '' as $$
  select 'assignment'::text, a.id, null::uuid, a.group_id::text, c.id, c.ear_tag, c.box_id,
    a.name, a.notes, e.due_date, e.task_occurrence_322, a.times_per_day,
    case when a.recurring and a.ends_on is not null then e.due_date - a.starts_on + 1 end,
    case when a.recurring and a.ends_on is not null then a.ends_on - a.starts_on + 1 end,
    e.task_completed_at_322, e.event_date, e.task_completed_by_322,
    coalesce(e.task_completed_by_name_322, public._task_actor_name_322(e.task_completed_by_322)),
    'completed'::text, false, false, null::text
  from public.calf_events e
  join public.calf_task_assignments_322 a on a.id = e.task_assignment_id_322
    and a.farm_id = e.farm_id and a.calf_id = e.calf_id
  join public.calves c on c.id = e.calf_id and c.farm_id = e.farm_id
  where e.farm_id = p_farm_id and (p_calf_id is null or e.calf_id = p_calf_id)
    and (p_actual_on is null or e.event_date = p_actual_on)
    and e.kind = 'task' and e.task_status = 'done' and e.task_assignment_id_322 is not null
$$;

create function public._followup_task_rows_322(p_farm_id uuid, p_calf_id uuid, p_today date)
returns setof public._task_row_322
language sql stable set search_path = '' as $$
  select 'followup'::text, null::uuid, f.id, null::text, c.id, c.ear_tag, c.box_id,
    'Nachkontrolle: ' || f.title, f.notes, f.due_on, null::integer, null::integer,
    null::integer, null::integer, f.task_completed_at_322, f.completed_on, f.task_completed_by_322,
    coalesce(f.task_completed_by_name_322, public._task_actor_name_322(f.task_completed_by_322)),
    case
      when f.status = 'done' then 'completed'
      when f.due_on < p_today then 'overdue'
      when f.due_on = p_today then 'today'
      else 'planned'
    end,
    false, false, null::text
  from public.calf_followups f
  join public.calves c on c.id = f.calf_id and c.farm_id = f.farm_id
  where f.farm_id = p_farm_id and (p_calf_id is null or f.calf_id = p_calf_id)
    and (f.status = 'done' or f.status = 'open' and c.status = 'active' and c.archived_at is null)
$$;

create function public.list_farm_tasks_322(p_farm_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_farm_member(p_farm_id) then
    raise exception 'Kein Zugriff auf diesen Betrieb.' using errcode = '42501';
  end if;
  with assignments as (
    select a.*, c.ear_tag, c.box_id
    from public.calf_task_assignments_322 a
    join public.calves c on c.id = a.calf_id and c.farm_id = a.farm_id
    where a.farm_id = p_farm_id and a.ended_at is null and c.status = 'active' and c.archived_at is null
  ), assignment_dates as (
    -- Für geplante Serien genügt der erste künftige Tag. Vergangene offene
    -- Durchführungen bleiben sichtbar und werden niemals fiktiv quittiert.
    select a.*, a.starts_on + series.day_offset as planned_date
    from assignments a
    cross join lateral generate_series(0, least(coalesce(a.ends_on, v_today), v_today) - a.starts_on)
      as series(day_offset)
    union all
    select a.*, greatest(a.starts_on, v_today + 1)
    from assignments a
    where a.ends_on is null or greatest(a.starts_on, v_today + 1) <= a.ends_on
  ), open_tasks as (
    select 'assignment'::text as source, a.id as assignment_id, null::uuid as event_id,
      a.group_id::text as group_id, a.calf_id, a.ear_tag, a.box_id, a.name, a.notes,
      a.planned_date as due_date, runs.occurrence, a.times_per_day,
      case when a.recurring and a.ends_on is not null then a.planned_date - a.starts_on + 1 end as treatment_day,
      case when a.recurring and a.ends_on is not null then a.ends_on - a.starts_on + 1 end as treatment_days,
      null::timestamptz as completed_at, null::date as completed_on,
      null::uuid as completed_by, null::text as completed_by_name,
      case when a.planned_date < v_today then 'overdue'
        when a.planned_date = v_today then 'today' else 'planned' end as category,
      false as is_treatment, true as can_end, null::text as priority
    from assignment_dates a
    cross join lateral generate_series(1, a.times_per_day) as runs(occurrence)
    where not exists (
      select 1 from public.calf_events e
      where e.task_assignment_id_322 = a.id and e.due_date = a.planned_date
        and e.task_occurrence_322 = runs.occurrence
    )
  ), vaccines as (
    select 'vaccination'::text, null::uuid, v.id, null::text, c.id, c.ear_tag, c.box_id,
      'Folgeimpfung: ' || v.vaccine_name, v.notes, v.next_due_on,
      null::integer, null::integer, null::integer, null::integer,
      null::timestamptz, null::date, null::uuid, null::text,
      case when v.next_due_on < v_today then 'overdue'
        when v.next_due_on = v_today then 'today' else 'planned' end,
      false, false, null::text
    from public.calf_vaccinations v
    join public.calves c on c.id = v.calf_id and c.farm_id = v.farm_id
    where v.farm_id = p_farm_id and v.next_due_on is not null and c.status = 'active' and c.archived_at is null
      and not exists (
        select 1 from public.calf_vaccinations later
        where later.farm_id = v.farm_id and later.calf_id = v.calf_id
          and later.administered_on > v.administered_on
          and (later.medicine_id = v.medicine_id or
            lower(btrim(later.vaccine_name)) = lower(btrim(v.vaccine_name)))
      )
  ), all_tasks as (
    select * from open_tasks
    union all select * from public._assignment_completed_rows_322(p_farm_id, null, v_today)
    union all select * from public._legacy_task_rows_322(p_farm_id, null, v_today) l
      where l.category <> 'completed' or l.completed_on = v_today
    union all select * from public._followup_task_rows_322(p_farm_id, null, v_today) f
      where f.category <> 'completed' or f.completed_on = v_today
    union all select * from vaccines
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by
    t.due_date, (t.priority = 'urgent') desc nulls last, t.ear_tag, t.name, t.occurrence), '[]'::jsonb)
  into v_rows from all_tasks t;

  return jsonb_build_object('today', v_today, 'rows', v_rows);
end;
$$;

create function public.list_calf_task_history_322(p_farm_id uuid, p_calf_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_farm_member(p_farm_id) then
    raise exception 'Kein Zugriff auf diesen Betrieb.' using errcode = '42501';
  end if;
  if p_calf_id is null or not exists (
    select 1 from public.calves c where c.id = p_calf_id and c.farm_id = p_farm_id
  ) then
    raise exception 'Kalb ist in diesem Betrieb nicht vorhanden.' using errcode = '22023';
  end if;
  with rows as (
    select * from public._assignment_completed_rows_322(p_farm_id, p_calf_id, null)
    union all select * from public._legacy_task_rows_322(p_farm_id, p_calf_id, v_today)
      where category = 'completed'
    union all select * from public._followup_task_rows_322(p_farm_id, p_calf_id, v_today)
      where category = 'completed'
  )
  select coalesce(jsonb_agg(to_jsonb(t) order by coalesce(t.completed_on, t.due_date) desc,
    t.completed_at desc nulls last, t.name, t.occurrence), '[]'::jsonb)
  into v_rows from rows t;
  return v_rows;
end;
$$;

-- Die 3.2.1-PWA darf während der Aktualisierung noch den alten Endpunkt
-- aufrufen. Eine vorgeschaltete Zeilensperre schützt auch diese Aufrufe.
-- Der bisherige Rückgabetyp und die Arzneimittellogik bleiben erhalten.
alter function public.complete_farm_task_320(uuid,uuid) rename to _complete_farm_task_original_320;
revoke all on function public._complete_farm_task_original_320(uuid,uuid) from public, anon, authenticated, service_role;

create function public.complete_farm_task_320(p_farm_id uuid, p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_event public.calf_events%rowtype;
begin
  if auth.uid() is null or not public.is_farm_member(p_farm_id) then
    raise exception 'Kein Zugriff auf diesen Betrieb.' using errcode = '42501';
  end if;
  select e.* into v_event from public.calf_events e
  join public.calves c on c.id = e.calf_id and c.farm_id = e.farm_id
  where e.id = p_event_id and e.farm_id = p_farm_id and e.kind = 'task'
    and e.task_assignment_id_322 is null and c.status = 'active' and c.archived_at is null
  for update of e for share of c;
  if not found or v_event.task_ended_at_322 is not null then
    raise exception 'Die Aufgabe ist nicht mehr offen.' using errcode = '22023';
  end if;
  if v_event.task_status = 'done' then
    raise exception 'Diese Durchführung wurde bereits dokumentiert.' using errcode = '23514';
  end if;
  perform public._complete_farm_task_original_320(p_farm_id, p_event_id);
end;
$$;
revoke all on function public.complete_farm_task_320(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.complete_farm_task_320(uuid,uuid) to authenticated;

create function public.complete_farm_tasks_322(p_farm_id uuid, p_tasks jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_today date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  v_key record;
  v_assignment public.calf_task_assignments_322%rowtype;
  v_event public.calf_events%rowtype;
  v_followup public.calf_followups%rowtype;
  v_count integer := 0;
begin
  if v_actor is null or not public.is_farm_member(p_farm_id) then
    raise exception 'Kein Zugriff auf diesen Betrieb.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_tasks) is distinct from 'array' or jsonb_array_length(p_tasks) = 0 then
    raise exception 'Bitte mindestens eine Durchführung auswählen.' using errcode = '22023';
  end if;

  -- Die stabile Reihenfolge vermeidet unterschiedliche Sperrreihenfolgen
  -- bei gleichzeitigen Gruppenbestätigungen.
  for v_key in
    select distinct coalesce(k.source, case when k.assignment_id is not null then 'assignment' else 'legacy' end) as source,
      k.assignment_id, k.event_id, k.due_date, k.occurrence
    from jsonb_to_recordset(p_tasks) as k(source text, assignment_id uuid, event_id uuid, due_date date, occurrence integer)
    order by source, assignment_id, event_id, due_date, occurrence
  loop
    if v_key.due_date is null or v_key.due_date > v_today then
      raise exception 'Diese Durchführung ist noch nicht fällig.' using errcode = '22023';
    end if;

    if v_key.source = 'assignment' and v_key.assignment_id is not null and v_key.event_id is null then
      select a.* into v_assignment from public.calf_task_assignments_322 a
      join public.calves c on c.id = a.calf_id and c.farm_id = a.farm_id
      where a.farm_id = p_farm_id and a.id = v_key.assignment_id and c.status = 'active' and c.archived_at is null
      for update of a for share of c;
      if not found or v_key.occurrence is null or v_key.occurrence not between 1 and v_assignment.times_per_day
        or v_key.due_date < v_assignment.starts_on
        or (v_assignment.ends_on is not null and v_key.due_date > v_assignment.ends_on)
      then
        raise exception 'Diese Durchführung gehört zu keiner gültigen Aufgabe.' using errcode = '22023';
      end if;
      if exists (
        select 1 from public.calf_events e where e.task_assignment_id_322 = v_assignment.id
          and e.due_date = v_key.due_date and e.task_occurrence_322 = v_key.occurrence
      ) then
        continue;
      end if;
      if v_assignment.ended_at is not null then
        raise exception 'Diese Aufgabe ist beendet.' using errcode = '22023';
      end if;

      insert into public.calf_events (
        farm_id, calf_id, event_date, kind, details, task_status, priority,
        due_date, task_assignment_id_322, task_occurrence_322
      ) values (
        p_farm_id, v_assignment.calf_id, v_today, 'task',
        concat_ws(chr(10), v_assignment.name, v_assignment.notes), 'done', 'normal',
        v_key.due_date, v_assignment.id, v_key.occurrence
      )
      on conflict (task_assignment_id_322, due_date, task_occurrence_322)
        where task_assignment_id_322 is not null do nothing;
      if found then v_count := v_count + 1; end if;

    elsif v_key.source = 'legacy' and v_key.event_id is not null and v_key.assignment_id is null then
      select e.* into v_event from public.calf_events e
      join public.calves c on c.id = e.calf_id and c.farm_id = e.farm_id
      where e.farm_id = p_farm_id and e.id = v_key.event_id and e.kind = 'task'
        and e.task_assignment_id_322 is null and c.status = 'active' and c.archived_at is null
      for update of e for share of c;
      if not found or coalesce(v_event.due_date, v_event.event_date) <> v_key.due_date then
        raise exception 'Diese Aufgabe ist nicht mehr verfügbar.' using errcode = '22023';
      end if;
      if v_event.task_status = 'done' then continue; end if;
      perform public.complete_farm_task_320(p_farm_id, v_event.id);
      if not exists (
        select 1 from public.calf_events e where e.id = v_event.id and e.farm_id = p_farm_id and e.task_status = 'done'
      ) then
        raise exception 'Die Durchführung der bisherigen Aufgabe konnte nicht bestätigt werden.';
      end if;
      v_count := v_count + 1;

    elsif v_key.source = 'followup' and v_key.event_id is not null and v_key.assignment_id is null then
      select f.* into v_followup from public.calf_followups f
      join public.calves c on c.id = f.calf_id and c.farm_id = f.farm_id
      where f.farm_id = p_farm_id and f.id = v_key.event_id and c.status = 'active' and c.archived_at is null
      for update of f for share of c;
      if not found or v_followup.due_on <> v_key.due_date or v_followup.status not in ('done','open') then
        raise exception 'Diese Nachkontrolle ist nicht mehr offen.' using errcode = '22023';
      end if;
      if v_followup.status = 'done' then continue; end if;
      update public.calf_followups f set status = 'done' where f.id = v_followup.id and f.farm_id = p_farm_id;
      v_count := v_count + 1;

    else
      raise exception 'Diese Aufgabe kann hier nicht abgehakt werden.' using errcode = '22023';
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.end_farm_task_322(p_farm_id uuid, p_assignment_id uuid, p_event_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_event public.calf_events%rowtype;
  v_group text;
begin
  if v_actor is null or not public.is_farm_member(p_farm_id) then
    raise exception 'Kein Zugriff auf diesen Betrieb.' using errcode = '42501';
  end if;
  if (p_assignment_id is null) = (p_event_id is null) then
    raise exception 'Bitte eine Aufgabe auswählen.' using errcode = '22023';
  end if;
  if p_assignment_id is not null then
    update public.calf_task_assignments_322 a set ended_at = clock_timestamp(), ended_by = v_actor
    where a.farm_id = p_farm_id and a.id = p_assignment_id and a.ended_at is null;
    if not found and not exists (
      select 1 from public.calf_task_assignments_322 a where a.farm_id = p_farm_id and a.id = p_assignment_id
    ) then
      raise exception 'Diese Aufgabe ist in diesem Betrieb nicht vorhanden.' using errcode = '22023';
    end if;
    return;
  end if;

  select e.* into v_event from public.calf_events e
  where e.farm_id = p_farm_id and e.id = p_event_id and e.kind = 'task' and e.task_assignment_id_322 is null;
  if not found then
    raise exception 'Diese Aufgabe ist in diesem Betrieb nicht vorhanden.' using errcode = '22023';
  end if;
  v_group := public._legacy_treatment_group_322(v_event.details);

  perform e.id from public.calf_events e
  where e.farm_id = p_farm_id and e.calf_id = v_event.calf_id and e.kind = 'task'
    and e.task_assignment_id_322 is null and e.task_ended_at_322 is null
    and e.task_status is distinct from 'done'
    and (e.id = p_event_id or (v_group is not null and public._legacy_treatment_group_322(e.details) = v_group))
  order by e.id for update;
  update public.calf_events e set task_ended_at_322 = statement_timestamp(), task_ended_by_322 = v_actor
  where e.farm_id = p_farm_id and e.calf_id = v_event.calf_id and e.kind = 'task'
    and e.task_assignment_id_322 is null and e.task_ended_at_322 is null
    and e.task_status is distinct from 'done'
    and (e.id = p_event_id or (v_group is not null and public._legacy_treatment_group_322(e.details) = v_group));
end;
$$;

revoke all on function
  public._task_actor_name_322(uuid),
  public._legacy_treatment_group_322(text),
  public._guard_calf_task_events_322(),
  public._guard_followup_history_322(),
  public._keep_medical_history_322(),
  public._legacy_task_rows_322(uuid,uuid,date),
  public._assignment_completed_rows_322(uuid,uuid,date),
  public._followup_task_rows_322(uuid,uuid,date),
  public.create_farm_tasks_322(uuid,uuid[],uuid,text,boolean,integer,date,date,text,uuid),
  public.list_farm_tasks_322(uuid),
  public.list_calf_task_history_322(uuid,uuid),
  public.complete_farm_tasks_322(uuid,jsonb),
  public.end_farm_task_322(uuid,uuid,uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.create_farm_tasks_322(uuid,uuid[],uuid,text,boolean,integer,date,date,text,uuid),
  public.list_farm_tasks_322(uuid),
  public.list_calf_task_history_322(uuid,uuid),
  public.complete_farm_tasks_322(uuid,jsonb),
  public.end_farm_task_322(uuid,uuid,uuid)
to authenticated;

notify pgrst, 'reload schema';
commit;
