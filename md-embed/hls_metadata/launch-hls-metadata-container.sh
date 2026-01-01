#!/bin/bash
set -e

CONTAINER_NAME="bento4-hls"
IMAGE_NAME="localhost/bento4-hls:latest"
GIT_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT_DIR="$GIT_ROOT/md-embed/hls_metadata"

METADATA_DIR="${METADATA_DIR:-$SCRIPT_DIR/metadata}"
SEGMENTS_DIR="${SEGMENTS_DIR:-$SCRIPT_DIR/segments}"
OUTPUT_DIR="${OUTPUT_DIR:-$SCRIPT_DIR/output}"

# required working directories
if [[ ! -d "$METADATA_DIR" ]]; then
    echo "Error: $METADATA_DIR not found"
    exit 1
fi
if [[ ! -d "$SEGMENTS_DIR" ]]; then
    echo "Error: $SEGMENTS_DIR not found"
    exit 1
fi
mkdir -p "$OUTPUT_DIR"

FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
    FORCE_REBUILD=true
fi

if [[ "$FORCE_REBUILD" == true ]] || ! podman image exists "$IMAGE_NAME"; then
    podman build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"
fi

if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
elif podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    exec podman attach "$CONTAINER_NAME"
elif podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    exec podman attach "$CONTAINER_NAME"
fi

podman run --rm -it \
    --name "$CONTAINER_NAME" \
    --userns=keep-id \
    -v "$METADATA_DIR:/work/metadata:ro" \
    -v "$SEGMENTS_DIR:/work/segments:ro" \
    -v "$OUTPUT_DIR:/work/output:rw" \
    "$IMAGE_NAME"
