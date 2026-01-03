#!/bin/bash
set -e

# prerequisite: s3cmd --configure
s3cmd sync \
    --delete-removed \
    --exclude '*.md' \
    /workspace/site-root/ \
    s3://camden-wander/
