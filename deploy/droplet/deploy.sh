#!/usr/bin/env bash
# Runs on the droplet, from /opt/wave.
#   ./deploy.sh <tag>   deploy that image tag (a commit SHA from main)
#   ./deploy.sh         re-apply the current tag, e.g. after editing .env
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${1:-}" ]; then
  echo "$1" > .image-tag
fi
if [ ! -s .image-tag ]; then
  echo "No image tag yet. Run: ./deploy.sh <commit-sha>" >&2
  exit 1
fi
export IMAGE_TAG
IMAGE_TAG="$(cat .image-tag)"
echo "Deploying $IMAGE_TAG"

docker compose pull
docker compose up -d --remove-orphans
# Picks up Caddyfile edits; a bind-mounted file change does not recreate the container.
docker compose exec -T web caddy reload --config /etc/caddy/Caddyfile
# Keep a week of old images so a rollback does not need a pull.
docker image prune -af --filter "until=168h" >/dev/null
docker compose ps
