-- Auf der lokalen 3.2.2-Datenbank nach tests/tasks-db-322.sql ausführen.
begin;
set local role authenticated;

do $$
declare
  own_farm constant uuid := 'b0000000-0000-4000-8000-000000000001';
  other_farm constant uuid := 'b0000000-0000-4000-8000-000000000002';
  own_calf constant uuid := 'd0000000-0000-4000-8000-000000000002';
  other_calf constant uuid := 'd0000000-0000-4000-8000-000000000004';
  snapshot jsonb;
  changed uuid;
begin
  perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(own_farm,own_calf,current_date,'morning','yellow',now() - interval '3 hours')
    returning to_jsonb(calf_feeding_rounds) into snapshot;

  perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
  update public.calves set health_status='red'
    where id=own_calf and farm_id=own_farm and status='active' and health_status='green'
    returning id into changed;
  if changed is distinct from own_calf then
    raise exception 'Mitarbeiter kann den Status im eigenen Betrieb nicht ändern';
  end if;

  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(own_farm,own_calf,current_date,'morning','red',now()),
          (own_farm,own_calf,current_date,'noon','red',now())
    on conflict(farm_id,calf_id,feeding_date,round) do nothing;
  if (select to_jsonb(r) from public.calf_feeding_rounds r
        where farm_id=own_farm and calf_id=own_calf and feeding_date=current_date and round='morning')
      is distinct from snapshot then
    raise exception 'Gespeicherte Runde wurde nachträglich verändert';
  end if;
  if (select status from public.calf_feeding_rounds
        where farm_id=own_farm and calf_id=own_calf and feeding_date=current_date and round='noon')
      is distinct from 'red' then
    raise exception 'Mitarbeiter kann eine neue Runde im eigenen Betrieb nicht dokumentieren';
  end if;

  update public.calves set health_status='green'
    where id=own_calf and farm_id=own_farm and status='active' and health_status='yellow';
  if found then raise exception 'Veralteter Ausgangsstatus hat Rot überschrieben'; end if;

  perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
  insert into public.calf_feeding_rounds(farm_id,calf_id,feeding_date,round,status,updated_at)
    values(other_farm,other_calf,current_date,'morning','red',now());

  perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
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
