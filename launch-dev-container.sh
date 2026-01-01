#!/bin/bash
set -e

CONTAINER_NAME="portfolio-site-dev-sandbox"
IMAGE_NAME="portfolio-site-dev-sandbox"
GIT_ROOT="$(git rev-parse --show-toplevel)"

FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
    FORCE_REBUILD=true
fi

if [[ "$FORCE_REBUILD" == true ]] || ! podman image exists "$IMAGE_NAME"; then
    podman build -t "$IMAGE_NAME" -f "$GIT_ROOT/Dockerfile" "$GIT_ROOT"
fi

if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
elif podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    exec podman attach "$CONTAINER_NAME"
elif podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    exec podman attach "$CONTAINER_NAME"
fi

podman run -it \
    --name "$CONTAINER_NAME" \
    --userns=keep-id \
    -v "$GIT_ROOT:/workspace" \
    -v "$HOME/.claude-container:/home/developer/.claude" \
    -p 8080:8080 \
    -w /workspace \
    "$IMAGE_NAME"
