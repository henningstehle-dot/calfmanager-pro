#!/usr/bin/env bash
set -euo pipefail
schema_path="${1:-}"
if [[ -n "$schema_path" ]]; then
  schema_path="$(realpath -- "$schema_path")"
  [[ -r "$schema_path" ]] || { echo 'Der übergebene Schemaexport ist nicht lesbar.' >&2; exit 1; }
fi
cd "$(dirname "$0")/.."

container="calfmanager-db-322-test-$$"
output_dir="$(mktemp -d)"
image=postgres:16-alpine
if [[ -n "$schema_path" ]]; then image=postgres:17.12-alpine; fi
trap 'docker stop "$container" >/dev/null 2>&1 || true; rm -r -- "$output_dir"' EXIT
docker run --rm -d --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust "$image" >/dev/null

for ((attempt = 0; attempt < 60; attempt++)); do
  if docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -q; then
    break
  fi
  sleep 0.25
done
docker exec "$container" pg_isready -h 127.0.0.1 -U postgres -q

sql() {
  docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -q -U postgres "$@"
}
sql < tests/fixtures/supabase-auth-322.sql
if [[ -n "$schema_path" ]]; then
  # Der schema-only Export legt public an. Entfernt nur das leere Schema im Testcontainer.
  sql -c 'drop schema public;'
  sql < "$schema_path"
  sql < tests/fixtures/actual-321-before.sql
else
  cat supabase/schema.sql supabase/migration_2_3_0.sql supabase/migration_2_5_0.sql supabase/migration_2_6_0.sql \
    supabase/migration_2_6_1.sql supabase/migration_2_7_0.sql supabase/migration_2_8_0.sql \
    tests/fixtures/supabase-local-322.sql | sql
fi
sql < tests/fixtures/mat-backfill-322.sql
if [[ -n "$schema_path" ]]; then
  # Fehler am Ende simulieren und kontrollieren, dass der vorherige Stand nutzbar bleibt.
  if sed '/^commit;$/i select 1 / 0;' supabase/migration_3_2_2.sql | sql > "$output_dir/rollback.log" 2>&1; then
    echo 'Erwarteter Migrationsfehler blieb aus.' >&2; exit 1
  fi
  [[ $(<"$output_dir/rollback.log") == *'division by zero'* ]] || { cat "$output_dir/rollback.log"; exit 1; }
  [[ "$(sql -Atc "select to_regclass('public.calf_task_assignments_322') is null and to_regprocedure('public.complete_farm_task_320(uuid,uuid)') is not null;")" == t ]]
fi
sql < supabase/migration_3_2_2.sql
if [[ -n "$schema_path" ]]; then sql < tests/actual-321-compatibility.sql; fi
sql < tests/mat-db-322.sql
sql < tests/tasks-db-322.sql

# Zwei echte Datenbanksitzungen bestätigen gleichzeitig dieselbe Durchführung.
sql -qAt -v actor=a0000000-0000-4000-8000-000000000002 -v pause=2 < tests/fixtures/task-concurrent-322.sql > "$output_dir/employee" &
first_pid=$!
sql -qAt -v actor=a0000000-0000-4000-8000-000000000001 -v pause=0 < tests/fixtures/task-concurrent-322.sql > "$output_dir/owner" &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
if [[ "$(sort "$output_dir/employee" "$output_dir/owner")" != $'0\n1' ]]; then
  cat "$output_dir/employee" "$output_dir/owner"
  exit 1
fi
sql <<'SQL'
do $$
begin
  if (select count(*) from public.calf_events e
    join public.calf_task_assignments_322 a on a.id = e.task_assignment_id_322
    where a.name = 'Parallel') <> 1 then
    raise exception 'Die parallele Durchführung wurde nicht genau einmal gespeichert';
  end if;
end;
$$;
SQL
echo "$image: Migration, MAT, Aufgaben und konkurrierende Bestätigung erfolgreich."
