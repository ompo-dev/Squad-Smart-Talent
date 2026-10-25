#!/usr/bin/env bash
# Invoked remotely by deploy.yml; does not clone code or alter another project.
set -Eeuo pipefail
umask 077

root=${1:?Usage: deploy.sh ROOT ENVIRONMENT IMAGE}
environment=${2:?Environment required}
image=${3:?Immutable image digest required}
release=$(cd -- "$(dirname -- "$0")" && pwd -P)

[[ "$environment" == dev || "$environment" == prod ]] || { echo 'Invalid environment' >&2; exit 2; }
[[ "$root" =~ ^/[a-zA-Z0-9_/-]+$ && "$root" != / && "$root" != *..* ]] || { echo 'Invalid deployment root' >&2; exit 2; }
[[ "$image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[0-9a-f]{64}$ ]] || { echo 'Deploy requires an immutable GHCR digest' >&2; exit 2; }
[[ "$release" == "$root"/releases/* && -f "$release/.env" ]] || { echo 'Release must be inside ROOT/releases and contain .env' >&2; exit 2; }

export APP_IMAGE="$image"
export DOCKER_CONFIG="$release/docker-auth"
project="telemetry-$environment"
compose() { docker compose --project-name "$project" --env-file "$release/.env" -f "$release/compose.yml" "$@"; }
previous=''
if [[ -L "$root/current" ]]; then
  previous=$(readlink -f -- "$root/current")
  [[ "$previous" == "$root"/releases/* && -f "$previous/image" ]] || { echo 'Invalid previous release' >&2; exit 2; }
fi
cleanup_auth() {
  docker logout ghcr.io >/dev/null 2>&1 || true
}
trap cleanup_auth EXIT

# Fail before touching running services if configuration or pull is invalid.
compose config --quiet
compose pull web worker realtime migrate
compose up -d --wait --wait-timeout 120 postgres redis
mkdir -p -- "$root/backups"
# Backups intentionally remain on failure; retention is an operator policy.
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$root/backups/$(basename -- "$release").sql.gz"

# Stop background writers before schema updates. Existing web stays until replacement.
compose stop worker
if ! compose run --rm --no-deps migrate; then
  echo 'Migration failed. No destructive database rollback is attempted.' >&2
  if [[ -n "$previous" ]]; then
    APP_IMAGE=$(cat -- "$previous/image") docker compose --project-name "$project" --env-file "$previous/.env" -f "$previous/compose.yml" up -d --no-deps worker
  fi
  exit 1
fi

if compose up -d --wait --wait-timeout 180 web worker realtime && compose exec -T web node -e 'fetch("http://localhost:3000/api/health").then(async r=>process.exit(r.ok&&(await r.json()).status==="ok"?0:1)).catch(()=>process.exit(1))'; then
  printf '%s\n' "$image" > "$release/image"
  if [[ -n "$previous" ]]; then ln -sfn -- "$previous" "$root/previous"; fi
  ln -sfn -- "$release" "$root/current"
  printf 'Deployment healthy: %s\n' "$environment"
else
  echo 'Release failed healthchecks; restoring previous application image if available.' >&2
  if [[ -n "$previous" ]]; then
    APP_IMAGE=$(cat -- "$previous/image") docker compose --project-name "$project" --env-file "$previous/.env" -f "$previous/compose.yml" up -d --wait --wait-timeout 180 web worker realtime
  else
    compose stop web worker realtime
  fi
  # Schema changes and persistent volumes are never rolled back automatically.
  exit 1
fi
