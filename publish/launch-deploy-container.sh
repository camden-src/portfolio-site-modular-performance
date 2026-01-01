#!/bin/bash
set -e

CONTAINER_NAME="site-deploy"
IMAGE_NAME="site-deploy"
GIT_ROOT="$(git rev-parse --show-toplevel)"

# prerequisite: ~/.s3cfg from s3cmd --configure
if [[ ! -f "$HOME/.s3cfg" ]]; then
    echo "Error: ~/.s3cfg not found"
    exit 1
fi

FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
    FORCE_REBUILD=true
fi

if [[ "$FORCE_REBUILD" == true ]] || ! podman image exists "$IMAGE_NAME"; then
    podman build -t "$IMAGE_NAME" -f "$GIT_ROOT/publish/Dockerfile" "$GIT_ROOT/publish"
fi

if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
elif podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman exec -it "$CONTAINER_NAME" /workspace/publish/deploy.sh
    exit 0
elif podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    podman exec -it "$CONTAINER_NAME" /workspace/publish/deploy.sh
    exit 0
fi

podman run --rm \
    --name "$CONTAINER_NAME" \
    -v "$GIT_ROOT:/workspace:ro" \
    -v "$HOME/.s3cfg:/home/developer/.s3cfg:ro" \
    "$IMAGE_NAME"
