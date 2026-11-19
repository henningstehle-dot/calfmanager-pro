-- CalfManager Pro 2.4.4: dauerhaft eindeutige fünfstellige Nutzer-ID.
-- Vorhandene auth.users-UUIDs bleiben unverändert.
create sequence if not exists public.calfmanager_user_number_seq as integer start with 10001 increment by 1 minvalue 10001 maxvalue 99999 no cycle;
create table if not exists public.user_public_ids (
 user_id uuid primary key references auth.users(id) on delete cascade,
 public_id integer not null unique default nextval('public.calfmanager_user_number_seq'),
 assigned_at timestamptz not null default now(),
 constraint user_public_ids_five_digits check (public_id between 10001 and 99999)
);
-- Nummern nicht durch reguläre Nutzer änderbar machen.
alter table public.user_public_ids enable row level security;
revoke all on public.user_public_ids from anon, authenticated;
-- Bereits existierende Nutzer erhalten IDs in deterministischer Reihenfolge.
insert into public.user_public_ids(user_id)
select u.id from auth.users u
where not exists(select 1 from public.user_public_ids p where p.user_id=u.id)
order by u.created_at,u.id
on conflict (user_id) do nothing;
-- Trigger läuft auch bei späteren Mitarbeiterregistrierungen.
create or replace function public.assign_user_public_id_244()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.user_public_ids(user_id) values(new.id) on conflict(user_id) do nothing;
 return new;
end $$;
drop trigger if exists assign_user_public_id_244 on auth.users;
create trigger assign_user_public_id_244 after insert on auth.users
for each row execute function public.assign_user_public_id_244();
-- Auch nach Nutzerlöschung dürfen Nummern nie erneut vergeben werden: NO CYCLE-Sequenz.
create or replace function public.my_public_id_244()
returns integer language sql stable security definer set search_path = '' as $$
 select p.public_id from public.user_public_ids p where p.user_id=(select auth.uid());
$$;
revoke all on function public.my_public_id_244() from public;
grant execute on function public.my_public_id_244() to authenticated;
-- Admin-Daten als separate Erweiterung: bestehende RPCs und Rechte bleiben erhalten.
create or replace function public.admin_directory_244()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_platform_admin() then raise exception 'Keine Administratorberechtigung'; end if;
 return jsonb_build_object(
  'users', coalesce((select jsonb_agg(jsonb_build_object(
   'id',u.id,'first_name',coalesce(u.raw_user_meta_data->>'first_name',''),
   'last_name',coalesce(u.raw_user_meta_data->>'last_name',''),
   'public_id',p.public_id)) from auth.users u
   left join public.user_public_ids p on p.user_id=u.id),'[]'::jsonb),
  'farms', coalesce((select jsonb_agg(jsonb_build_object(
   'id',f.id,'street_address',f.street_address,'postal_code',f.postal_code,'city',f.city))
   from public.farms f),'[]'::jsonb)
 );
end $$;
revoke all on function public.admin_directory_244() from public;
grant execute on function public.admin_directory_244() to authenticated;
create or replace function public.admin_farm_members_244(p_farm_id uuid)
returns table(user_id uuid,first_name text,last_name text,email text,role text,public_id integer)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_platform_admin() then raise exception 'Keine Administratorberechtigung'; end if;
 return query select u.id,coalesce(u.raw_user_meta_data->>'first_name','')::text,
 coalesce(u.raw_user_meta_data->>'last_name','')::text,u.email::text,fm.role::text,p.public_id
 from public.farm_members fm join auth.users u on u.id=fm.user_id
 left join public.user_public_ids p on p.user_id=u.id
 where fm.farm_id=p_farm_id order by fm.created_at,u.id;
end $$;
revoke all on function public.admin_farm_members_244(uuid) from public;
grant execute on function public.admin_farm_members_244(uuid) to authenticated;
