#!/usr/bin/env bash
set -euo pipefail
umask 077
revision="${1:?Expected full Git revision}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 2
test "$(git rev-parse HEAD)" = "$revision"
mapfile -t web_ids < <(docker ps -q | xargs -r docker inspect --format '{{.Id}} {{range .NetworkSettings.Networks}}{{range .Aliases}}{{.}} {{end}}{{end}}' | awk '$0 ~ /(^| )scalegrams-web( |$)/ {print $1}')
test "${#web_ids[@]}" -eq 1
backup_root="${SCALEGRAMS_BACKUP_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/scalegrams/backups}"
backup="$backup_root/ux-audit-web-$revision"
mkdir -p "$backup"
if [[ ! -f "$backup/READY_WEB" ]]; then
  web_image="$(docker inspect --format '{{.Image}}' "${web_ids[0]}")"
  docker image save "$web_image" | gzip > "$backup/web-image.tar.gz.tmp"
  gzip -t "$backup/web-image.tar.gz.tmp"
  mv "$backup/web-image.tar.gz.tmp" "$backup/web-image.tar.gz"
  printf '%s\n' "$web_image" > "$backup/web-image-id.txt"
  curl --fail --silent --show-error https://scalegrams.neticar.com.ar/ > "$backup/previous-index.html"
  touch "$backup/READY_WEB"
fi
GIT_HASH="$revision" /opt/infra/bin/deploy-service scalegrams web
for attempt in $(seq 1 12); do
  version="$(curl --fail --silent https://scalegrams.neticar.com.ar/version.json || true)"
  if grep -Fq "$revision" <<<"$version"; then
    printf 'Web published revision %s; backup %s\n' "$revision" "$backup"
    exit 0
  fi
  sleep 5
done
printf 'Web revision verification failed. Backup: %s\n' "$backup" >&2
exit 1
