#!/bin/bash
set -e

CONTAINER_NAME="portfolio-site-dev-server"
IMAGE_NAME="portfolio-site-dev-server"
GIT_ROOT="$(git rev-parse --show-toplevel)"
CONTEXT="$GIT_ROOT/dev-server"
SITE_ROOT="$GIT_ROOT/site-root"

FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
    FORCE_REBUILD=true
fi

if [[ "$FORCE_REBUILD" == true ]] || ! podman image exists "$IMAGE_NAME"; then
    podman build -t "$IMAGE_NAME" -f "$CONTEXT/Containerfile" "$CONTEXT"
fi

if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
fi

if podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Server is already running on http://localhost:8080"
    echo "To stop: podman stop $CONTAINER_NAME"
    exit 0
fi

if podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    echo "Server restarted on http://localhost:8080"
    exit 0
fi

podman run -d \
    --name "$CONTAINER_NAME" \
    -v "$GIT_ROOT/site-root:/usr/local/apache2/htdocs/synth-performance" \
    -p 8080:8080 \
    "$IMAGE_NAME"

