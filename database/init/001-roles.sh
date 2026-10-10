#!/bin/sh
set -eu

: "${DB_RUNTIME_USER:?DB_RUNTIME_USER es obligatorio}"
: "${DB_RUNTIME_PASSWORD:?DB_RUNTIME_PASSWORD es obligatorio}"
: "${DB_MIGRATION_USER:?DB_MIGRATION_USER es obligatorio}"
: "${DB_MIGRATION_PASSWORD:?DB_MIGRATION_PASSWORD es obligatorio}"

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=runtime_user="$DB_RUNTIME_USER" \
  --set=runtime_password="$DB_RUNTIME_PASSWORD" \
  --set=migration_user="$DB_MIGRATION_USER" \
  --set=migration_password="$DB_MIGRATION_PASSWORD" \
  --set=database_name="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"runtime_user"
  LOGIN PASSWORD :'runtime_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

CREATE ROLE :"migration_user"
  LOGIN PASSWORD :'migration_password'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

GRANT CONNECT ON DATABASE :"database_name" TO :"runtime_user", :"migration_user";
GRANT USAGE ON SCHEMA public TO :"runtime_user", :"migration_user";
GRANT CREATE ON SCHEMA public TO :"migration_user";
SQL
