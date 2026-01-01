#!/bin/bash
set -e

# prerequisite: s3cmd --configure
s3cmd sync \
    --delete-removed \
    --exclude '*.md' \
    --exclude 'img/images.json' \
    --exclude 'hls/audio.json' \
    /workspace/site-root/ \
    s3://camden-wander/
# excluded metadata manifests must be updated when new ones are added
