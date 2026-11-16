-- CalfManager Pro 1.2.0: Ergänzung ohne Änderung bestehender Daten.
-- Nur im Supabase SQL Editor als Projektadministrator ausführen.
create or replace function public.platform_stats()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Keine Administratorberechtigung';
  end if;
  return jsonb_build_object(
    'farms', (select count(*) from public.farms),
    'users', (select count(*) from auth.users),
    'calves', (select count(*) from public.calves)
  );
end;
$$;
revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to authenticated;
