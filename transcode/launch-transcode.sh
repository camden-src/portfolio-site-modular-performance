#!/bin/bash

set -e

CONTAINER_NAME="hls-transcoder"
GIT_ROOT="$(git rev-parse --show-toplevel)"

FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
  FORCE_REBUILD=true
fi

# Check if container is already running
if podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if [[ "$FORCE_REBUILD" == true ]]; then
    echo "Stopping existing container..."
    podman stop "$CONTAINER_NAME"
  else
    echo "Container already running, attaching..."
    exec podman attach "$CONTAINER_NAME"
  fi
fi

# Check if container exists but is stopped
if podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if [[ "$FORCE_REBUILD" == true ]]; then
    echo "Removing existing container..."
    podman rm "$CONTAINER_NAME"
  else
    echo "Starting existing container..."
    podman start "$CONTAINER_NAME"
    exec podman attach "$CONTAINER_NAME"
  fi
fi

# Build and run new container
echo "Building container image..."
podman build -t hls-transcoder -f "$GIT_ROOT/transcode/Dockerfile" "$GIT_ROOT/transcode"

echo "Starting new container..."
podman run -it \
  --name "$CONTAINER_NAME" \
  --userns=keep-id \
  -v "$GIT_ROOT:/workspace" \
  -w /workspace \
  hls-transcoder
