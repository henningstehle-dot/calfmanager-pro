-- CalfManager Pro 2.4.3: Sichere Betriebserstellung mit Pflichtadresse.
-- Bestehende Betriebe und Benutzerdaten werden nicht verändert.
create or replace function public.create_farm_with_address(
  p_name text, p_street_address text, p_postal_code text, p_city text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if length(btrim(coalesce(p_name,''))) not between 1 and 150 then raise exception 'Betriebsname fehlt oder ist zu lang'; end if;
  if length(btrim(coalesce(p_street_address,''))) not between 1 and 160 then raise exception 'Straße und Hausnummer fehlen'; end if;
  if coalesce(p_postal_code,'') !~ '^[0-9]{5}$' then raise exception 'Ungültige Postleitzahl'; end if;
  if length(btrim(coalesce(p_city,''))) not between 1 and 100 then raise exception 'Ort fehlt'; end if;
  insert into public.farms(name,street_address,postal_code,city)
  values(btrim(p_name),btrim(p_street_address),p_postal_code,btrim(p_city)) returning id into v_id;
  insert into public.farm_members(farm_id,user_id,role) values(v_id,auth.uid(),'owner');
  return v_id;
end;
$$;
revoke all on function public.create_farm_with_address(text,text,text,text) from public;
grant execute on function public.create_farm_with_address(text,text,text,text) to authenticated;
-- Der bisherige RPC ohne Adresse darf nicht weiter zur Anlage verwendet werden.
-- Die neue Funktion ersetzt ihn für die App-Version 2.4.3.
revoke execute on function public.create_farm(text) from authenticated;
