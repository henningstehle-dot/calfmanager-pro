#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

container="calfmanager-db-322-test-$$"
docker run --rm -d --network none --name "$container" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
trap 'docker stop "$container" >/dev/null' EXIT

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
cat tests/fixtures/supabase-auth-322.sql supabase/schema.sql \
  supabase/migration_2_5_0.sql supabase/migration_2_6_0.sql supabase/migration_2_6_1.sql \
  supabase/migration_2_7_0.sql supabase/migration_2_8_0.sql \
  tests/fixtures/supabase-local-322.sql tests/fixtures/mat-backfill-322.sql \
  supabase/migration_3_2_2.sql | sql
sql < tests/mat-db-322.sql
sql < tests/tasks-db-322.sql

# Zwei echte Datenbanksitzungen bestätigen gleichzeitig dieselbe Durchführung.
output_dir="$(mktemp -d)"
trap 'docker stop "$container" >/dev/null; rm -r -- "$output_dir"' EXIT
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
echo 'PostgreSQL 16: Migration, MAT, Aufgaben und konkurrierende Bestätigung erfolgreich.'
