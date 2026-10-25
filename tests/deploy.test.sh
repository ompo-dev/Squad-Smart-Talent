#!/usr/bin/env bash
set -euo pipefail
# Exercise deployment recovery with a fake Docker CLI; no daemon or remote host.
test_root=$(mktemp -d /tmp/telemetry-deploy-test-XXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
mkdir -p "$test_root/bin"
export DOCKER_TEST_LOG="$test_root/docker.log"
cat > "$test_root/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s %s\n' "${APP_IMAGE:-none}" "$*" >> "$DOCKER_TEST_LOG"
if [[ "$*" == *'exec -T postgres'* ]]; then printf '%s\n' '-- synthetic backup'; fi
if [[ "${FAIL_MODE:-}" == migration && "$*" == *'run --rm --no-deps migrate'* ]]; then exit 1; fi
if [[ "${FAIL_MODE:-}" == health && "$APP_IMAGE" == "$NEW_IMAGE" && "$*" == *'up -d --wait --wait-timeout 180 web worker realtime'* ]]; then exit 1; fi
MOCK
chmod +x "$test_root/bin/docker"
export PATH="$test_root/bin:$PATH"
export NEW_IMAGE="ghcr.io/ompo-dev/squad-smart-talent@sha256:$(printf 'a%.0s' {1..64})"
old_image="ghcr.io/ompo-dev/squad-smart-talent@sha256:$(printf 'b%.0s' {1..64})"

scenario() {
  local name=$1 mode=$2 previous=$3
  local root="$test_root/$name" release="$test_root/$name/releases/new"
  mkdir -p "$release"
  cp deploy/deploy.sh deploy/compose.yml "$release/"
  touch "$release/.env"
  if [[ "$previous" == yes ]]; then
    mkdir -p "$root/releases/old"
    cp deploy/compose.yml "$root/releases/old/"
    touch "$root/releases/old/.env"
    printf '%s\n' "$old_image" > "$root/releases/old/image"
    ln -s "$root/releases/old" "$root/current"
  fi
  : > "$DOCKER_TEST_LOG"
  export FAIL_MODE="$mode"
  if bash "$release/deploy.sh" "$root" dev "$NEW_IMAGE"; then
    [[ "$mode" == success ]]
    [[ "$(readlink -f "$root/current")" == "$release" ]]
    [[ "$(cat "$release/image")" == "$NEW_IMAGE" ]]
  else
    [[ "$mode" != success ]]
    if [[ "$previous" == yes ]]; then
      [[ "$(readlink -f "$root/current")" == "$root/releases/old" ]]
      grep -F "$old_image compose" "$DOCKER_TEST_LOG" >/dev/null
    else
      [[ ! -e "$root/current" ]]
      grep -F 'stop web worker realtime' "$DOCKER_TEST_LOG" >/dev/null
    fi
  fi
  test -s "$root/backups/new.sql.gz"
}
scenario healthy success yes
scenario migration-failed migration yes
scenario health-failed health yes
scenario first-deploy-failed health no
printf '%s\n' 'Deployment recovery scenarios passed'
