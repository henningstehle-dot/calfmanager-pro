-- Stellt die Nachmigrationseigenschaften der tatsächlichen 3.2.1-Definitionen sicher.
create function pg_temp.expect(p_value boolean, p_description text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception '%', p_description; end if;
end;
$$;

do $$
begin
  perform pg_temp.expect(not has_table_privilege('service_role','public.calf_treatments','truncate'),
    'Wartungsrolle darf Behandlungshistorie per TRUNCATE umgehen');
  perform pg_temp.expect(not has_table_privilege('anon','public.calf_task_assignments_322','truncate'),
    'Default Privileges erlauben Anonymen das Leeren der Zuordnungen');
  perform pg_temp.expect(not has_function_privilege('authenticated','public._complete_farm_task_original_320(uuid,uuid)','execute'),
    'Original-RPC umgeht den Endschutz');
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000002',false) as actor \gset
do $$
declare
  farm constant uuid := '32100000-0000-4000-8000-000000000011';
  other_farm constant uuid := '32100000-0000-4000-8000-000000000012';
  calf constant uuid := '32100000-0000-4000-8000-000000000021';
  other_calf constant uuid := '32100000-0000-4000-8000-000000000022';
  template constant uuid := '32100000-0000-4000-8000-000000000051';
  current_day constant date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  legacy_event record;
  history jsonb;
  events jsonb;
  ended_event uuid;
  next_plan uuid;
  next_event uuid;
  treatment uuid;
  vaccination uuid;
  checkup uuid;
  rec_count integer;
begin
  perform pg_temp.expect((select count(*) from public.farms)=1 and
    not exists(select 1 from public.calves where farm_id=other_farm), 'Mitarbeiter sieht fremde Betriebsdaten');
  perform pg_temp.expect((select count(*) from public.list_farm_members(farm))=2, 'Team-RPC für Mitarbeiter defekt');
  perform pg_temp.expect(not exists(select 1 from public.list_farm_members(farm) where last_sign_in_at is not null),
    'Mitarbeiter sehen fremde Anmeldezeitpunkte');
  select e.id, c.completed_at, c.completed_by into strict legacy_event
  from public.calf_events e join public.calf_task_completions_320 c on c.task_id=e.id where e.farm_id=farm;
  history := public.list_calf_task_history_322(farm,calf);
  perform pg_temp.expect((select count(*) from jsonb_array_elements(history) j
    where (j->>'event_id')::uuid=legacy_event.id
      and (j->>'completed_at')::timestamptz=legacy_event.completed_at
      and (j->>'completed_by')::uuid=legacy_event.completed_by
      and j->>'completed_by_name'='Test Mitarbeiter')=1,'Historische Auditdaten aus 3.2.1 fehlen oder wurden verändert');
  perform pg_temp.expect((select count(*) from public.calf_treatment_administrations_320 where farm_id=farm)=1,
    'Vor der Migration dokumentierte Medikamentengabe fehlt');
  events := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.expect((select count(*) from jsonb_array_elements(events) j
    where j->>'category'='completed' and j->>'event_id'=legacy_event.id::text)=1,
    'Heute erledigte Bestandsaufgabe fehlt');
  select (j->>'event_id')::uuid into strict ended_event from jsonb_array_elements(events) j
    where j->>'is_treatment'='true' and j->>'category'='today';
  perform public.end_farm_task_322(farm,null,ended_event);
  perform pg_temp.expect((select count(*) from jsonb_array_elements(public.list_farm_tasks_322(farm)->'rows') j
    where j->>'is_treatment'='true' and j->>'category'<>'completed')=0, 'Offene Einträge des beendeten Plans bleiben sichtbar');
  begin
    perform public.complete_farm_task_320(farm,ended_event);
    raise exception '3.2.1 kann einen bereits beendeten Plan nachträglich quittieren';
  exception when invalid_parameter_value then null; end;

  -- Alte UI-Operationen einschließlich des exakten void-Endpunkts ausführen.
  perform pg_temp.expect(public.schedule_treatment_320(farm,calf,template,current_day)=4,'Alte Planungsfunktion defekt');
  select id into strict next_plan from public.calf_treatment_plans_320 p
    where p.farm_id=farm and not exists(select 1 from public.calf_treatment_administrations_320 a where a.plan_id=p.id);
  select id into strict next_event from public.calf_events e
    where e.farm_id=farm and e.details like ('[BEHANDLUNG:'||next_plan::text||']%Tag 1/2 · Gabe 1/2%');
  perform public.complete_farm_task_320(farm,next_event);
  begin
    perform public.complete_farm_task_320(farm,next_event);
    raise exception 'Alte Bestätigung konnte doppelt gespeichert werden';
  exception when check_violation then null; end;
  perform pg_temp.expect((select count(*) from public.calf_treatment_administrations_320
    where task_id=next_event and plan_id=next_plan and administered_by=auth.uid())=1,'3.2.1-Medikamentengabe unvollständig');

  insert into public.calf_events(farm_id,calf_id,kind,event_date,details,milk_liters,task_status,priority)
    values(farm,calf,'feeding',current_day,'Lokale Tränke',3.5,'open','normal');
  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status)
    values(farm,calf,current_day,'morning','green')
    on conflict(farm_id,calf_id,feeding_date,round) do update set status=excluded.status;
  update public.calf_feeding_rounds set status='yellow' where farm_id=farm and calf_id=calf;
  perform pg_temp.expect((select status from public.calf_feeding_rounds where calf_id=calf)='yellow','Fütterung aus 3.2.1 defekt');

  insert into public.calf_treatments(farm_id,calf_id,medicine_name,started_on,ended_on,withdrawal_milk_days)
    values(farm,calf,'Synthetisches Präparat',current_day,current_day,2) returning id into treatment;
  update public.calf_treatments set notes='Eintrag berichtigt',withdrawal_milk_days=3 where id=treatment;
  perform pg_temp.expect((select milk_withdrawal_until from public.calf_treatments where id=treatment)=current_day+3,
    'Zulässige Behandlungskorrektur oder berechnete Wartezeit defekt');
  insert into public.calf_vaccinations(farm_id,calf_id,vaccine_name,administered_on)
    values(farm,calf,'Synthetischer Impfstoff',current_day) returning id into vaccination;
  update public.calf_vaccinations set notes='Eintrag berichtigt' where id=vaccination;
  insert into public.calf_followups(farm_id,calf_id,title,due_on)
    values(farm,calf,'Nachkontrolle',current_day) returning id into checkup;
  update public.calf_followups set status='done', completed_on=current_day where id=checkup;
  update public.calf_followups set notes='Eintrag berichtigt' where id=checkup;
  perform pg_temp.expect((select task_completed_by_322 from public.calf_followups where id=checkup)=auth.uid(),
    '3.2.1-Nachkontrolle verlor den Bearbeiter');
  begin
    insert into public.calf_treatments(farm_id,calf_id,medicine_name,started_on,ended_on)
      values(farm,other_calf,'Unzulässig',current_day,current_day);
    raise exception 'Fremdes Kalb in Behandlung akzeptiert';
  exception when foreign_key_violation then null; end;
  begin
    perform public.list_calf_task_history_322(farm,other_calf);
    raise exception 'Historie eines fremden Kalbes abrufbar';
  exception when invalid_parameter_value then null; end;

  update public.farm_growth_settings set min_gain_g=500 where farm_id=farm;
  get diagnostics rec_count=row_count;
  perform pg_temp.expect(rec_count=0,'Mitarbeiter dürfen Mindestzunahme nicht ändern');
end;
$$;

select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000001',false) as actor \gset
do $$
declare
  farm constant uuid := '32100000-0000-4000-8000-000000000011';
  ended_event constant uuid := '32100000-0000-4000-8000-000000000041';
  failed_deletes integer := 0;
begin
  insert into public.farm_growth_settings(farm_id,min_gain_g) values(farm,800)
  on conflict(farm_id) do update set farm_id=excluded.farm_id,min_gain_g=excluded.min_gain_g;
  perform pg_temp.expect((select min_gain_g from public.farm_growth_settings where farm_id=farm)=800,
    'Betriebsleitung kann Mindestzunahme nicht speichern');
  perform public.end_farm_task_322(farm,null,ended_event);
  begin
    delete from public.calf_treatments where farm_id=farm;
  exception when check_violation then failed_deletes:=failed_deletes+1; end;
  begin
    delete from public.calf_vaccinations where farm_id=farm;
  exception when check_violation then failed_deletes:=failed_deletes+1; end;
  begin
    delete from public.calf_followups where farm_id=farm;
  exception when check_violation then failed_deletes:=failed_deletes+1; end;
  perform pg_temp.expect(failed_deletes=3,'Betriebsleitung konnte dokumentierte Historie löschen');

  insert into public.calf_followups(farm_id,calf_id,title,due_on)
  values(farm,'32100000-0000-4000-8000-000000000021','Irrtümlicher offener Entwurf',current_date);
  delete from public.calf_followups where farm_id=farm and title='Irrtümlicher offener Entwurf';
  perform pg_temp.expect(found,'Zulässige Löschung eines offenen Entwurfs blockiert');
end;
$$;

select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000004',false) as actor \gset
do $$
declare
  farm constant uuid := '32100000-0000-4000-8000-000000000011';
  member_id constant uuid := '32100000-0000-4000-8000-000000000002';
  removable constant uuid := '32100000-0000-4000-8000-000000000005';
begin
  perform pg_temp.expect(public.is_platform_admin(),'Plattformadmin nicht erkannt');
  perform pg_temp.expect((select count(*) from public.admin_list_users())>=5 and
    (select count(*) from public.admin_list_farms())>=2 and
    (select count(*) from public.admin_farm_members_244(farm))=2 and public.platform_stats() is not null,
    'Admin-Übersichten beschädigt');
  perform pg_temp.expect(public.admin_target_has_farm(member_id) and not public.admin_target_has_farm(removable)
    and not public.admin_is_target_admin(removable),'Admin-Löschprüfung defekt');
  perform public.admin_log_user_deletion(removable,'delete_requested');
  perform public.admin_manage('block',member_id);
  perform pg_temp.expect(not exists(select 1 from public.calves) and
    not exists(select 1 from public.calf_treatment_administrations_320),'Plattformadmin hat ohne Mitgliedschaft Zugriff auf Tierdaten');
  begin
    perform public.list_farm_tasks_322(farm);
    raise exception 'Plattformadmin hat ohne Mitgliedschaft Aufgaben-Zugriff';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000002',false) as actor \gset
do $$
begin
  perform pg_temp.expect(not exists(select 1 from public.calves),'Gesperrter Mitarbeiter sieht Kälber');
  begin
    perform public.list_farm_tasks_322('32100000-0000-4000-8000-000000000011');
    raise exception 'Gesperrter Mitarbeiter sieht Aufgaben';
  exception when insufficient_privilege then null; end;
end;
$$;

select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000004',false) as actor \gset
select public.admin_manage('unblock','32100000-0000-4000-8000-000000000002');
reset role;

-- Das Auth-API löscht das Konto über die verwaltete Auth-Rolle. Hier wird nur
-- dessen Datenbankoperation in der isolierten Auth-Nachbildung ausgeführt.
set role supabase_auth_admin;
delete from auth.users where id='32100000-0000-4000-8000-000000000005';
reset role;
select pg_temp.expect(exists(select 1 from public.calf_events
 where id='32100000-0000-4000-8000-000000000041' and assigned_to is null and task_ended_at_322 is not null),
 'Zulässige Kontolöschung blockiert oder Aufgabe dabei verändert');

-- Die produktive 3.2.1-Referenz für altes Arzneimittelaudit bleibt bestehen.
do $$
begin
  begin
    delete from auth.users where id='32100000-0000-4000-8000-000000000002';
    raise exception 'Bestehende FK-Sicherung für historisch referenziertes Konto fehlt';
  exception when foreign_key_violation then null; end;
end;
$$;

set role authenticated;
select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000004',false) as actor \gset
select public.admin_log_user_deletion('32100000-0000-4000-8000-000000000005','delete');
reset role;
