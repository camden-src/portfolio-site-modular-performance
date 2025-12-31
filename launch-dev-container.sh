#!/bin/bash

GIT_ROOT="$(git rev-parse --show-toplevel)"
CONTAINER_NAME="portfolio-site-dev-sandbox"
FORCE_REBUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force-rebuild)
      FORCE_REBUILD=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--force-rebuild]"
      exit 1
      ;;
  esac
done

if [ "$FORCE_REBUILD" = true ]; then
  echo "Force rebuild requested, removing existing container..."
  podman rm -f "$CONTAINER_NAME" 2>/dev/null
fi

if podman container exists "$CONTAINER_NAME" 2>/dev/null; then
  echo "Reattaching to existing container..."
  podman start -ai "$CONTAINER_NAME"
else
  echo "Creating new container..."
  podman run -it \
    --name "$CONTAINER_NAME" \
    --userns=keep-id \
    -v "$GIT_ROOT:/workspace" \
    -v "$HOME/.claude-container:/home/developer/.claude" \
    -p 8080:8080 \
    -w /workspace \
    portfolio-site-dev-sandbox
fi
