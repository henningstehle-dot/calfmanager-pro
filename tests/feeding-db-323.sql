-- Auf der lokalen 3.2.2-Datenbank nach tests/tasks-db-322.sql ausführen.
begin;
set local role authenticated;

do $$
declare
  owner_user constant uuid := 'a0000000-0000-4000-8000-000000000001';
  employee_user constant uuid := 'a0000000-0000-4000-8000-000000000002';
  other_user constant uuid := 'a0000000-0000-4000-8000-000000000003';
  own_farm constant uuid := 'b0000000-0000-4000-8000-000000000001';
  other_farm constant uuid := 'b0000000-0000-4000-8000-000000000002';
  own_calf constant uuid := 'd0000000-0000-4000-8000-000000000002';
  other_calf constant uuid := 'd0000000-0000-4000-8000-000000000004';
  snapshot jsonb;
  changed uuid;
begin
  perform set_config('request.jwt.claim.sub',owner_user::text,true);
  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(own_farm,own_calf,current_date,'morning','yellow',now() - interval '3 hours')
    returning to_jsonb(calf_feeding_rounds) into snapshot;
  if (snapshot->>'updated_by')::uuid is distinct from owner_user then
    raise exception 'Originale Fütterungsrunde hat keinen korrekten Bearbeiter';
  end if;

  perform set_config('request.jwt.claim.sub',employee_user::text,true);
  update public.calves set health_status='red'
    where id=own_calf and farm_id=own_farm and status='active' and health_status='green'
    returning id into changed;
  if changed is distinct from own_calf then
    raise exception 'Mitarbeiter kann den Status im eigenen Betrieb nicht ändern';
  end if;

  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(own_farm,own_calf,current_date,'morning','red',now())
    on conflict(farm_id,calf_id,feeding_date,round) do nothing;
  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(own_farm,own_calf,current_date,'noon','red',now())
    on conflict(farm_id,calf_id,feeding_date,round) do nothing;
  if (select to_jsonb(r) from public.calf_feeding_rounds r
        where farm_id=own_farm and calf_id=own_calf and feeding_date=current_date and round='morning')
      is distinct from snapshot then
    raise exception 'Gespeicherte Runde wurde nachträglich verändert';
  end if;
  if not exists(select from public.calf_feeding_rounds
      where farm_id=own_farm and calf_id=own_calf and feeding_date=current_date and round='noon'
        and status='red' and updated_by=employee_user) then
    raise exception 'Fütterungsrunde wurde nicht unter dem ausführenden Mitarbeiter gespeichert';
  end if;
  begin
    insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_by)
      values(own_farm,own_calf,current_date,'evening','red',owner_user);
    raise exception 'Mitarbeiter kann einen anderen Bearbeiter für seine Runde angeben';
  exception when insufficient_privilege then
    null;
  end;

  update public.calves set health_status='green'
    where id=own_calf and farm_id=own_farm and status='active' and health_status='yellow';
  if found then raise exception 'Veralteter Ausgangsstatus hat Rot überschrieben'; end if;

  perform set_config('request.jwt.claim.sub',other_user::text,true);
  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(other_farm,other_calf,current_date,'morning','red',now());

  perform set_config('request.jwt.claim.sub',employee_user::text,true);
  if exists(select from public.calves where id=other_calf)
      or exists(select from public.calf_feeding_rounds where calf_id=other_calf) then
    raise exception 'Mitarbeiter sieht Daten eines fremden Betriebs';
  end if;
  update public.calves set health_status='yellow'
    where id=other_calf and farm_id=other_farm and status='active';
  if found then raise exception 'Mitarbeiter kann fremden Kälberstatus ändern'; end if;
  begin
    insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
      values(other_farm,other_calf,current_date,'evening','yellow',now())
      on conflict(farm_id,calf_id,feeding_date,round) do nothing;
    raise exception 'Mitarbeiter kann fremde Fütterungsrunde dokumentieren';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

rollback;
