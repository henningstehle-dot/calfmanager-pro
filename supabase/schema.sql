-- CalfManager Pro 1.0.0 – im Supabase SQL Editor ausführen.
create extension if not exists pgcrypto;
create table if not exists public.platform_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table if not exists public.farms(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 150),created_at timestamptz not null default now());
create table if not exists public.farm_members(farm_id uuid not null references public.farms(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in ('owner','employee')),created_at timestamptz not null default now(),primary key(farm_id,user_id));
create table if not exists public.calves(id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms(id) on delete cascade,ear_tag text not null,name text,birth_date date not null,sex text not null check(sex in ('female','male')),breed text,status text not null default 'active' check(status in ('active','left')),notes text,created_at timestamptz not null default now(),unique(farm_id,ear_tag),unique(id,farm_id));
create table if not exists public.calf_events(id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms(id) on delete cascade,calf_id uuid not null,event_date date not null,kind text not null check(kind in ('health','weight','feeding','task')),details text not null default '',weight_kg numeric(8,2) check(weight_kg is null or weight_kg between 0 and 2000),created_at timestamptz not null default now(),foreign key(calf_id,farm_id) references public.calves(id,farm_id) on delete cascade);
create index if not exists idx_farm_members_user on public.farm_members(user_id);
create index if not exists idx_calves_farm on public.calves(farm_id);
create index if not exists idx_events_farm on public.calf_events(farm_id);
create index if not exists idx_events_calf on public.calf_events(calf_id);
-- SECURITY DEFINER helpers avoid recursive RLS policies.
create or replace function public.is_farm_member(p_farm_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.farm_members where farm_id=p_farm_id and user_id=(select auth.uid())) $$;
create or replace function public.is_farm_owner(p_farm_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.farm_members where farm_id=p_farm_id and user_id=(select auth.uid()) and role='owner') $$;
create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.platform_admins where user_id=(select auth.uid())) $$;
revoke all on function public.is_farm_member(uuid),public.is_farm_owner(uuid),public.is_platform_admin() from public;
grant execute on function public.is_farm_member(uuid),public.is_farm_owner(uuid),public.is_platform_admin() to authenticated;
alter table public.platform_admins enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.calves enable row level security;
alter table public.calf_events enable row level security;
create policy "farm read" on public.farms for select to authenticated using(public.is_farm_member(id));
create policy "members read" on public.farm_members for select to authenticated using(public.is_farm_member(farm_id));
create policy "calves read" on public.calves for select to authenticated using(public.is_farm_member(farm_id));
create policy "calves insert" on public.calves for insert to authenticated with check(public.is_farm_member(farm_id));
create policy "calves update" on public.calves for update to authenticated using(public.is_farm_member(farm_id)) with check(public.is_farm_member(farm_id));
create policy "calves delete" on public.calves for delete to authenticated using(public.is_farm_member(farm_id));
create policy "events read" on public.calf_events for select to authenticated using(public.is_farm_member(farm_id));
create policy "events insert" on public.calf_events for insert to authenticated with check(public.is_farm_member(farm_id));
create policy "events update" on public.calf_events for update to authenticated using(public.is_farm_member(farm_id)) with check(public.is_farm_member(farm_id));
create policy "events delete" on public.calf_events for delete to authenticated using(public.is_farm_member(farm_id));
-- Only authenticated users may create a farm; membership is established atomically.
create or replace function public.create_farm(p_name text) returns uuid language plpgsql security definer set search_path='' as $$ declare v_id uuid;begin if auth.uid() is null then raise exception 'Nicht angemeldet';end if;if length(trim(p_name)) not between 1 and 150 then raise exception 'Ungültiger Betriebsname';end if;insert into public.farms(name) values(trim(p_name)) returning id into v_id;insert into public.farm_members(farm_id,user_id,role) values(v_id,auth.uid(),'owner');return v_id;end $$;
-- Add an EXISTING registered account by email. Email addresses are never returned to callers except team members.
create or replace function public.add_existing_member(p_farm_id uuid,p_email text) returns void language plpgsql security definer set search_path='' as $$ declare v_user uuid;begin if not public.is_farm_owner(p_farm_id) then raise exception 'Nur Betriebsinhaber dürfen Mitarbeiter hinzufügen';end if;select id into v_user from auth.users where lower(email)=lower(trim(p_email)) and email_confirmed_at is not null limit 1;if v_user is null then raise exception 'Kein bestätigtes Benutzerkonto mit dieser E-Mail gefunden';end if;insert into public.farm_members(farm_id,user_id,role) values(p_farm_id,v_user,'employee') on conflict(farm_id,user_id) do nothing;end $$;
create or replace function public.list_farm_members(p_farm_id uuid) returns table(user_id uuid,role text,email text) language plpgsql stable security definer set search_path='' as $$ begin if not public.is_farm_member(p_farm_id) then raise exception 'Kein Zugriff';end if;return query select fm.user_id,fm.role,u.email::text from public.farm_members fm join auth.users u on u.id=fm.user_id where fm.farm_id=p_farm_id order by fm.created_at;end $$;
revoke all on function public.create_farm(text),public.add_existing_member(uuid,text),public.list_farm_members(uuid) from public;
grant execute on function public.create_farm(text),public.add_existing_member(uuid,text),public.list_farm_members(uuid) to authenticated;
-- IMPORTANT: Admin account is set manually after registration, using the SQL editor:
-- insert into public.platform_admins(user_id) select id from auth.users where email='DEINE-ADMIN-EMAIL' on conflict do nothing;
