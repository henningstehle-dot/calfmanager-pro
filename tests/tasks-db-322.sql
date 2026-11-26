create function pg_temp.verify(p_test boolean, p_message text) returns void language plpgsql as $$
begin
  if p_test is distinct from true then raise exception '%', p_message; end if;
end;
$$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('a0000000-0000-4000-8000-000000000001','owner@example.invalid','{"first_name":"Anna","last_name":"Leitung"}'),
 ('a0000000-0000-4000-8000-000000000002','member@example.invalid','{"first_name":"Eva","last_name":"Team"}'),
 ('a0000000-0000-4000-8000-000000000003','other@example.invalid','{}');
insert into public.farms(id,name) values
 ('b0000000-0000-4000-8000-000000000001','Testbetrieb A'),
 ('b0000000-0000-4000-8000-000000000002','Testbetrieb B');
insert into public.farm_members(farm_id,user_id,role) values
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','owner'),
 ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','employee'),
 ('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','owner');
insert into public.farm_boxes(id,farm_id,name,kind) values
 ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Box 1','group');
insert into public.calves(id,farm_id,ear_tag,birth_date,sex,status,box_id) values
 ('d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','DE1',current_date-5,'female','active','c0000000-0000-4000-8000-000000000001'),
 ('d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','DE2',current_date-6,'female','active',null),
 ('d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','DE3',current_date-7,'female','archived',null),
 ('d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','DE4',current_date-8,'female','active',null);

insert into public.farm_treatment_templates_320(id,farm_id,name,days,times_per_day,is_halocur)
values ('f1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Testkur',2,2,false);
insert into public.calf_treatment_plans_320(id,farm_id,calf_id,template_id,start_date,created_by)
values ('f0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',
 'd0000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
 (now() at time zone 'Europe/Berlin')::date,'a0000000-0000-4000-8000-000000000001');

insert into public.calf_events(id,farm_id,calf_id,kind,details,event_date,due_date,task_status) values
 ('e0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','task','[BEHANDLUNG:f0000000-0000-4000-8000-000000000001] Testkur – Tag 1/2 – Anwendung 1/2',
 (now() at time zone 'Europe/Berlin')::date,(now() at time zone 'Europe/Berlin')::date,'open'),
 ('e0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','task','[BEHANDLUNG:f0000000-0000-4000-8000-000000000001] Testkur – Tag 1/2 – Anwendung 2/2',
 (now() at time zone 'Europe/Berlin')::date,(now() at time zone 'Europe/Berlin')::date,'open'),
 ('e0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','task','[BEHANDLUNG:f0000000-0000-4000-8000-000000000001] Testkur – Tag 2/2 – Anwendung 1/2',
 (now() at time zone 'Europe/Berlin')::date,(now() at time zone 'Europe/Berlin')::date + 1,'open'),
 ('e0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','task','Vor 3.2.2 erledigt',
 (now() at time zone 'Europe/Berlin')::date - 3,(now() at time zone 'Europe/Berlin')::date - 3,'done');
insert into public.calf_task_completions_320(task_id,farm_id,completed_at,completed_by) values
 ('e0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000001',now() - interval '3 days','a0000000-0000-4000-8000-000000000001');

insert into public.calf_followups(id,farm_id,calf_id,title,due_on) values
 ('e0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Kontrolle',(now() at time zone 'Europe/Berlin')::date-1);
insert into public.calf_vaccinations(id,farm_id,calf_id,vaccine_name,administered_on,next_due_on) values
 ('e0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Testimpfung',(now() at time zone 'Europe/Berlin')::date-8,(now() at time zone 'Europe/Berlin')::date+1),
 ('e0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Alte Impfung',(now() at time zone 'Europe/Berlin')::date-8,(now() at time zone 'Europe/Berlin')::date-2),
 ('e0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Alte Impfung',(now() at time zone 'Europe/Berlin')::date-1,null);

set role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',false) as actor \gset
insert into public.farm_task_templates_322(farm_id,name,recurring,times_per_day,duration_days)
 values ('b0000000-0000-4000-8000-000000000001','Eigene Vorlage',true,2,3)
 returning id as template_id \gset
select set_config('calfmanager.test.template_id', :'template_id',false) as template \gset

do $$
declare
  farm constant uuid := 'b0000000-0000-4000-8000-000000000001';
  calf1 constant uuid := 'd0000000-0000-4000-8000-000000000001';
  calf2 constant uuid := 'd0000000-0000-4000-8000-000000000002';
  archived constant uuid := 'd0000000-0000-4000-8000-000000000003';
  foreign_calf constant uuid := 'd0000000-0000-4000-8000-000000000004';
  group_request constant uuid := 'f0000000-0000-4000-8000-000000000002';
  template constant uuid := current_setting('calfmanager.test.template_id')::uuid;
  today constant date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  tasks jsonb;
begin
  begin
    perform public.create_farm_tasks_322(farm,array[calf1,foreign_calf],null,'Unvollständig',false,1,today,null,null);
    raise exception 'Betriebsfremdes Kalb akzeptiert';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.create_farm_tasks_322(farm,array[calf1,archived],null,'Unvollständig',false,1,today,null,null);
    raise exception 'Archiviertes Kalb akzeptiert';
  exception when invalid_parameter_value then null; end;

  perform pg_temp.verify(public.create_farm_tasks_322(farm,array[calf1,calf2],template,'Gruppenkontrolle',true,2,today-1,today+1,'Hinweis',group_request)=2,
    'Gruppenaufgabe nicht vollständig angelegt');
  perform pg_temp.verify(public.create_farm_tasks_322(farm,array[calf2,calf1,calf1],template,'Gruppenkontrolle',true,2,today-1,today+1,'Hinweis',group_request)=2,
    'Wiederholte Anlage nicht idempotent');
  update public.farm_task_templates_322 set active = false, name = 'Überarbeitet' where id = template;
  begin
    perform public.create_farm_tasks_322(farm,array[calf1],template,'Deaktiviert',false,1,today,null,null);
    raise exception 'Deaktivierte Vorlage akzeptiert';
  exception when invalid_parameter_value then null; end;

  perform public.create_farm_tasks_322(farm,array[calf2],null,'Parallel',true,1,today,null,null);
  perform public.create_farm_tasks_322(farm,array[calf2],null,'Später',false,1,today+28,null,null);
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify(not exists(select 1 from jsonb_array_elements(tasks) j where j->>'name' = 'Unvollständig'), 'Teilweise Gruppenanlage gespeichert');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Gruppenkontrolle')=12, 'Feste Serie falsch über drei Termine erzeugt');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Gruppenkontrolle' and j->>'category'='overdue')=4, 'Überfällige Durchführungen fehlen');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'category' in ('today','overdue'))=12, 'Fällige Durchführungszahl falsch');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'source'='vaccination')=1, 'Impfhinweise falsch abgegrenzt');
  perform pg_temp.verify(exists(select 1 from jsonb_array_elements(tasks) j where j->>'name'='Später' and j->>'category'='planned' and j->>'due_date'=(today+28)::text), 'Einzeltermin in vier Wochen fehlt');
  perform pg_temp.verify(exists(select 1 from jsonb_array_elements(tasks) j where j->>'event_id'='e0000000-0000-4000-8000-000000000002' and j->>'occurrence'='2' and j->>'treatment_days'='2'), 'Behandlungstag oder Durchführungsnummer fehlt');
end;
$$;

select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',false) as actor \gset
do $$
declare
  farm constant uuid := 'b0000000-0000-4000-8000-000000000001';
  foreign_farm constant uuid := 'b0000000-0000-4000-8000-000000000002';
  calf1 constant uuid := 'd0000000-0000-4000-8000-000000000001';
  calf2 constant uuid := 'd0000000-0000-4000-8000-000000000002';
  template constant uuid := current_setting('calfmanager.test.template_id')::uuid;
  today constant date := (statement_timestamp() at time zone 'Europe/Berlin')::date;
  tasks jsonb;
  history jsonb;
  batch jsonb;
  v_assignment uuid;
begin
  begin
    perform public.list_farm_tasks_322(foreign_farm);
    raise exception 'Betriebsübergreifender Listen-Zugriff möglich';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.calf_task_assignments_322;
    raise exception 'Direkter Zugriff auf Zuordnungen möglich';
  exception when insufficient_privilege then null; end;
  update public.farm_task_templates_322 set name='Unberechtigt' where id=template;
  perform pg_temp.verify((select name from public.farm_task_templates_322 where id=template)='Überarbeitet', 'Mitarbeiter konnte Aufgabenvorlage ändern');
  begin
    update public.calf_events set kind='health' where id='e0000000-0000-4000-8000-000000000003';
    raise exception 'Behandlungsaufgabe konnte umetikettiert werden';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm <> 'Geschützte Aufgabe darf nicht geändert werden' then raise; end if;
  end;

  update public.calves set box_id='c0000000-0000-4000-8000-000000000001' where id=calf2;
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Gruppenkontrolle' and j->>'box_id'='c0000000-0000-4000-8000-000000000001')=12, 'Zuordnung nach Umstallung verloren');
  select jsonb_agg(j) into batch from jsonb_array_elements(tasks) j
    where j->>'name'='Gruppenkontrolle' and j->>'category'='today' and j->>'occurrence'='1';
  begin
    perform public.complete_farm_tasks_322(farm, batch || jsonb_build_array(
      jsonb_build_object('source','legacy','event_id','e0000000-0000-4000-8000-000000000099','due_date',today)));
    raise exception 'Ungültiger Gruppenabschluss akzeptiert';
  exception when invalid_parameter_value then null; end;
  perform pg_temp.verify(public.complete_farm_tasks_322(farm,batch)=2, 'Sammelbestätigung unvollständig');
  perform pg_temp.verify(public.complete_farm_tasks_322(farm,batch)=0, 'Wiederholte Sammelbestätigung doppelt gespeichert');

  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Gruppenkontrolle' and j->>'category'='today' and j->>'occurrence'='2')=2, 'Zweite Durchführung am selben Tag fehlt');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Gruppenkontrolle' and j->>'category'='completed' and j->>'completed_by_name'='Eva Team' and j->>'completed_at' is not null)=2, 'Tatsächliche Uhrzeit und Mitarbeiter fehlen');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'category' in ('today','overdue'))=10, 'Fällige Durchführungszahl wurde nicht aktualisiert');
  select (j->>'assignment_id')::uuid into v_assignment from jsonb_array_elements(tasks) j
    where j->>'name'='Gruppenkontrolle' and j->>'calf_id'=calf1::text limit 1;
  perform public.end_farm_task_322(farm,v_assignment,null);
  perform public.end_farm_task_322(farm,v_assignment,null);
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify(not exists(select 1 from jsonb_array_elements(tasks) j where j->>'assignment_id'=v_assignment::text and j->>'category'<>'completed'), 'Beendete Aufgabe bleibt offen');
  perform pg_temp.verify(exists(select 1 from jsonb_array_elements(tasks) j where j->>'assignment_id'=v_assignment::text and j->>'category'='completed'), 'Beendigung hat Historie entfernt');

  select jsonb_agg(j) into batch from jsonb_array_elements(tasks) j
    where j->>'event_id' in ('e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000005');
  perform pg_temp.verify(public.complete_farm_tasks_322(farm,batch)=2, 'Legacy-Behandlung und Nachkontrolle wurden nicht gespeichert');
  begin
    perform public.complete_farm_task_320(farm,'e0000000-0000-4000-8000-000000000001');
    raise exception 'Alter RPC hat doppelte Medizinbuchung zugelassen';
  exception when check_violation then null; end;
  perform public.end_farm_task_322(farm,null,'e0000000-0000-4000-8000-000000000002');
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify(not exists(select 1 from jsonb_array_elements(tasks) j where j->>'event_id' in (
    'e0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000003')), 'Beendete Behandlung erzeugt weiter Aufgaben');

  perform public.create_farm_tasks_322(farm,array[calf1],null,'Vor Archivierung',true,1,today,null,null);
  update public.calves set status='left' where id=calf1;
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify(not exists(select 1 from jsonb_array_elements(tasks) j where j->>'name'='Vor Archivierung'), 'Ausgeschiedenes Kalb hat offene Aufgaben');
  update public.calves set status='archived', archived_at=clock_timestamp() where id=calf1;
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify(not exists(select 1 from jsonb_array_elements(tasks) j where j->>'name'='Vor Archivierung'), 'Archiviertes Kalb hat offene Aufgaben');
  history := public.list_calf_task_history_322(farm,calf1);
  perform pg_temp.verify(jsonb_array_length(history)=4, 'Historie nach Archivierung unvollständig');
  perform pg_temp.verify(exists(select 1 from jsonb_array_elements(history) j where j->>'name'='Vor 3.2.2 erledigt' and j->>'completed_by_name'='Anna Leitung'), 'Vorhandene Zeit- und Mitarbeiterhistorie nicht lesbar');

  begin
    delete from public.calf_events where id='e0000000-0000-4000-8000-000000000001';
    raise exception 'Behandlungshistorie konnte gelöscht werden';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm <> 'Bestätigte Aufgaben und Behandlungsaufgaben dürfen nicht gelöscht werden' then raise; end if;
  end;
  begin
    delete from public.calves where id=calf1;
    raise exception 'Kalb mit Historie konnte physisch gelöscht werden';
  exception when check_violation or foreign_key_violation or insufficient_privilege then null; end;

  -- Wechsel zum nächsten Kalendertag simulieren, indem die parallele,
  -- unbegrenzte Serie am Vortag begonnen wird. Gestern bleibt offen.
  perform public.create_farm_tasks_322(farm,array[calf2],null,'Tageswechsel',true,2,today-1,null,null);
  tasks := public.list_farm_tasks_322(farm)->'rows';
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Tageswechsel' and j->>'category'='today')=2, 'Wiederkehrende Aufgabe fehlt am Folgetag');
  perform pg_temp.verify((select count(*) from jsonb_array_elements(tasks) j where j->>'name'='Tageswechsel' and j->>'category'='overdue')=2, 'Gestern wurde fälschlich als erledigt gewertet');
end;
$$;

reset role;
select pg_temp.verify(
  (select count(*) from public.calf_treatment_administrations_320 where calf_id='d0000000-0000-4000-8000-000000000001')=1,
  'Tatsächliche Arzneimitteldokumentation fehlt oder ist doppelt'
);
insert into public.calf_treatments(farm_id,calf_id,medicine_name,started_on,ended_on)
values ('b0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','Synthetische Behandlung',current_date,current_date);
do $$
begin
  begin
    delete from public.calf_treatments where calf_id='d0000000-0000-4000-8000-000000000001';
    raise exception 'Tatsächliche Arzneimitteldokumentation konnte gelöscht werden';
  exception when check_violation then null; end;
end;
$$;
