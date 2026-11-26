-- Synthetische Daten für die Prüfung des unveränderten 3.2.1-Schemas.
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('32100000-0000-4000-8000-000000000001','owner@example.invalid',now(),'{"first_name":"Test","last_name":"Leitung"}'),
 ('32100000-0000-4000-8000-000000000002','employee@example.invalid',now(),'{"first_name":"Test","last_name":"Mitarbeiter"}'),
 ('32100000-0000-4000-8000-000000000003','other@example.invalid',now(),'{}'),
 ('32100000-0000-4000-8000-000000000004','admin@example.invalid',now(),'{}'),
 ('32100000-0000-4000-8000-000000000005','former@example.invalid',now(),'{}');

insert into public.platform_admins(user_id) values ('32100000-0000-4000-8000-000000000004');
insert into public.farms(id,name,street_address,postal_code,city) values
 ('32100000-0000-4000-8000-000000000011','Lokaler Betrieb A','Testweg 1','72070','Testort'),
 ('32100000-0000-4000-8000-000000000012','Lokaler Betrieb B','Testweg 2','72070','Testort');
insert into public.farm_members(farm_id,user_id,role) values
 ('32100000-0000-4000-8000-000000000011','32100000-0000-4000-8000-000000000001','owner'),
 ('32100000-0000-4000-8000-000000000011','32100000-0000-4000-8000-000000000002','employee'),
 ('32100000-0000-4000-8000-000000000012','32100000-0000-4000-8000-000000000003','owner');
insert into public.farm_boxes(id,farm_id,name,kind) values
 ('32100000-0000-4000-8000-000000000031','32100000-0000-4000-8000-000000000011','Iglu A','single'),
 ('32100000-0000-4000-8000-000000000032','32100000-0000-4000-8000-000000000012','Iglu B','single');
insert into public.calves(id,farm_id,ear_tag,birth_date,sex,status,box_id) values
 ('32100000-0000-4000-8000-000000000021','32100000-0000-4000-8000-000000000011','DE 321 A',current_date-14,'female','active','32100000-0000-4000-8000-000000000031'),
 ('32100000-0000-4000-8000-000000000022','32100000-0000-4000-8000-000000000012','DE 321 B',current_date-14,'female','active','32100000-0000-4000-8000-000000000032');

insert into public.calf_events(id,farm_id,calf_id,kind,details,event_date,due_date,task_status,assigned_to) values
 ('32100000-0000-4000-8000-000000000041','32100000-0000-4000-8000-000000000011','32100000-0000-4000-8000-000000000021',
   'task','Frühere Teamzuweisung',current_date,current_date,'open','32100000-0000-4000-8000-000000000005');

set role authenticated;
select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000001',false) as actor \gset
insert into public.farm_treatment_templates_320(id,farm_id,name,days,times_per_day,is_halocur)
values ('32100000-0000-4000-8000-000000000051','32100000-0000-4000-8000-000000000011','Reine Testvorlage',2,2,false);

select set_config('request.jwt.claim.sub','32100000-0000-4000-8000-000000000002',false) as actor \gset
do $$
declare
  farm constant uuid := '32100000-0000-4000-8000-000000000011';
  calf constant uuid := '32100000-0000-4000-8000-000000000021';
  template constant uuid := '32100000-0000-4000-8000-000000000051';
  event_id uuid;
begin
  if public.schedule_treatment_320(farm,calf,template,(now() at time zone 'Europe/Berlin')::date) <> 4 then
    raise exception '3.2.1 konnte keine Testbehandlung zur Vorbereitung anlegen';
  end if;
  select id into strict event_id from public.calf_events
  where farm_id=farm and details like '%Tag 1/2 · Gabe 1/2%';
  perform public.complete_farm_task_320(farm,event_id);
end;
$$;
reset role;
