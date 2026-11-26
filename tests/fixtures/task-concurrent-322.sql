set role authenticated;
select set_config('request.jwt.claim.sub', :'actor', false) as actor_check \gset
begin;
select public.complete_farm_tasks_322(
  'b0000000-0000-4000-8000-000000000001',
  (select jsonb_agg(j)
   from jsonb_array_elements(public.list_farm_tasks_322('b0000000-0000-4000-8000-000000000001')->'rows') j
   where j->>'name'='Parallel' and j->>'category'='today')
);
select pg_sleep(:pause) as pause_check \gset
commit;
