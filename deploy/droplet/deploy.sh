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

# Workflow logins to GHCR before calling this. A manual `./deploy.sh` (e.g.
# after editing .env) has no token, so pull would fail even when images are
# already on disk — keep going with what we have.
if ! docker compose pull; then
  echo "docker compose pull failed (often no GHCR login); continuing with local images" >&2
fi
docker compose up -d --remove-orphans
# Picks up Caddyfile edits; a bind-mounted file change does not recreate the container.
docker compose exec -T web caddy reload --config /etc/caddy/Caddyfile
# Keep a week of old images so a rollback does not need a pull.
docker image prune -af --filter "until=168h" >/dev/null
docker compose ps
