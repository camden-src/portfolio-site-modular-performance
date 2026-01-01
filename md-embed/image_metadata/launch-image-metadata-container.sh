#!/bin/bash
set -e

CONTAINER_NAME="image-metadata-tagger"
IMAGE_NAME="image-metadata-tagger"
GIT_ROOT="$(git rev-parse --show-toplevel)"

FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
    FORCE_REBUILD=true
fi

if [[ "$FORCE_REBUILD" == true ]] || ! podman image exists "$IMAGE_NAME"; then
    podman build -t "$IMAGE_NAME" -f "$GIT_ROOT/md-embed/image_metadata/Dockerfile" "$GIT_ROOT/md-embed/image_metadata"
fi

if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
elif podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman exec -it "$CONTAINER_NAME" /workspace/md-embed/image_metadata/embed-image-metadata.sh
    exit 0
elif podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    podman exec -it "$CONTAINER_NAME" /workspace/md-embed/image_metadata/embed-image-metadata.sh
    exit 0
fi

podman run --rm \
    --name "$CONTAINER_NAME" \
    --userns=keep-id \
    -v "$GIT_ROOT:/workspace" \
    -w /workspace \
    "$IMAGE_NAME"
