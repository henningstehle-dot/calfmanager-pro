-- CalfManager Pro 2.4.2: Administratorkonten aus der normalen Nutzerliste ausschließen.
-- Nur leere, adresslose Scheinbetriebe ausblenden, die ausschließlich Plattformadministratoren zugeordnet sind.
-- Keine Löschung und keine Änderung von Benutzerrechten oder Betriebsdaten.
create or replace function public.admin_dashboard_exclusions()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
 if not public.is_platform_admin() then raise exception 'Keine Administratorberechtigung'; end if;
 return jsonb_build_object(
  'admin_user_ids', coalesce((select jsonb_agg(pa.user_id) from public.platform_admins pa),'[]'::jsonb),
  'placeholder_farm_ids', coalesce((
    select jsonb_agg(f.id) from public.farms f
    where nullif(btrim(coalesce(f.street_address,'')),'') is null
      and nullif(btrim(coalesce(f.postal_code,'')),'') is null
      and nullif(btrim(coalesce(f.city,'')),'') is null
      and not exists (select 1 from public.calves c where c.farm_id=f.id)
      and exists (select 1 from public.farm_members fm join public.platform_admins pa on pa.user_id=fm.user_id where fm.farm_id=f.id)
      and not exists (select 1 from public.farm_members fm where fm.farm_id=f.id and not exists(select 1 from public.platform_admins pa where pa.user_id=fm.user_id))
  ),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.admin_dashboard_exclusions() from public;
grant execute on function public.admin_dashboard_exclusions() to authenticated;
