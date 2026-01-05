# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Container Environment

Claude Code runs inside a container. The /workspace/ directory is the git repository root, mounted from the host. Git operations (commit, push, pull, branch management) are performed by the user on the container host, not by Claude. Do not execute git commands; file changes made in /workspace/ will be visible to the host user for version control.

## Container Standards

All containers in this project follow standardized patterns for consistency, security, and host integration. These standards MUST be followed for all existing and future container implementations.

### Base Image Selection

**Principle: Always use the smallest suitable image for the task.**

**Image Priority (smallest to largest):**

1. **Alpine Linux** (smallest, ~5-7 MB base)
   - Use for: Shell scripts, CLI tools, simple utilities
   - Format: `alpine:3.21` (use latest stable version)
   - Examples: ffmpeg, exiftool, bash utilities

2. **Language-Specific Slim Variants** (optimized for language)
   - Use for: Tasks requiring specific language runtime
   - Python: `python:3.12-slim` or `python:3.13-slim` (NOT `python:3-slim`)
   - Node.js: `node:20-slim` or `node:22-slim` (NOT `node:slim`)
   - Rust: `rust:1-slim` (slim variant if available)
   - Go: Use multi-stage build with `golang:1.x-alpine` → `alpine:3.21`
   - Format: `language:MAJOR.MINOR-slim` (always specify version)

3. **Debian Slim** (broader compatibility, ~30-50 MB base)
   - Use for: Tools not available in Alpine, glibc requirements
   - Format: `debian:bookworm-slim` (use codename for stability)
   - Examples: s3cmd, compatibility-critical tools

4. **Multi-Stage Builds** (compile in large image, run in small image)
   - Use for: Compiled software requiring build tools
   - Pattern: `gcc:13` or `golang:1.x-alpine` → `alpine:3.21` or `debian:bookworm-slim`
   - Example: Bento4 (gcc:13 → debian:bookworm-slim)

**Version Specificity:**
- ✅ `python:3.12-slim`, `alpine:3.21`, `node:20-slim`, `debian:bookworm-slim`
- ❌ `python:3-slim`, `python:slim`, `alpine:latest`, `node:slim`
- Always specify MAJOR.MINOR or codename for reproducibility

### User and Permission Standards

**Host Environment:**
- This project assumes a **Debian-based host system**
- First non-root user typically has uid 1000, gid 1000
- Podman `--userns=keep-id` maps host user to container user

**Container User Configuration:**

```dockerfile
# Alpine-based images
RUN addgroup -g 1000 developer && adduser -u 1000 -G developer -D developer

# Debian/Ubuntu-based images
RUN useradd -m -u 1000 developer

USER developer
WORKDIR /workspace
```

**Requirements:**
- Developer user MUST have uid 1000 (maps to Debian host first user)
- Developer user MUST have gid 1000
- USER directive MUST switch to developer (non-root execution)
- WORKDIR MUST be set to `/workspace`
- Home directory: `/home/developer` (created by -m flag)

**UID/GID Mapping:**
```
Host (Debian)          Container
─────────────          ─────────
uid 1000 (user)   →    uid 1000 (developer)
gid 1000 (user)   →    gid 1000 (developer)
```

With `--userns=keep-id`, Podman ensures host user's permissions apply to files created in mounted volumes.

### Dockerfile Standards

**Package Installation Patterns:**

```dockerfile
# Alpine: Single-layer, no cache
RUN apk add --no-cache \
    package1 \
    package2 \
    package3

# Debian/Ubuntu: Update, install, cleanup in single layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    package1 \
    package2 \
    && rm -rf /var/lib/apt/lists/*
```

**Complete Dockerfile Template (Alpine):**
```dockerfile
FROM alpine:3.21

RUN apk add --no-cache \
    tool1 \
    tool2

RUN addgroup -g 1000 developer && adduser -u 1000 -G developer -D developer

USER developer
WORKDIR /workspace

ENTRYPOINT ["/workspace/path/to/script.sh"]
```

**Complete Dockerfile Template (Debian Slim):**
```dockerfile
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    package1 \
    package2 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 developer

USER developer
WORKDIR /workspace

CMD ["/bin/bash"]
```

**Complete Dockerfile Template (Language Slim):**
```dockerfile
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    tool1 \
    tool2 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 developer

USER developer
WORKDIR /workspace

# Install Python packages as developer user
RUN pip install --user --no-cache-dir package1 package2

ENV PATH="/home/developer/.local/bin:${PATH}"

CMD ["/workspace/path/to/script.sh"]
```

**Multi-Stage Build Template:**
```dockerfile
# Builder stage (large image with build tools)
FROM gcc:13 AS builder

WORKDIR /build
RUN git clone --depth 1 https://github.com/project/repo.git
WORKDIR /build/repo
RUN cmake -DCMAKE_BUILD_TYPE=Release . && make -j$(nproc)

# Runtime stage (minimal image)
FROM alpine:3.21

RUN apk add --no-cache libstdc++

COPY --from=builder /build/repo/bin /usr/local/bin/

RUN addgroup -g 1000 developer && adduser -u 1000 -G developer -D developer

USER developer
WORKDIR /workspace

CMD ["/bin/sh"]
```

### Launch Script Standards

**Required Script Header:**
```bash
#!/bin/bash
set -e

CONTAINER_NAME="descriptive-name"
IMAGE_NAME="descriptive-name"  # or "localhost/name:tag"
GIT_ROOT="$(git rev-parse --show-toplevel)"
```

**Force Rebuild Pattern:**
```bash
FORCE_REBUILD=false
if [[ "$1" == "--force-rebuild" ]]; then
    FORCE_REBUILD=true
fi

if [[ "$FORCE_REBUILD" == true ]] || ! podman image exists "$IMAGE_NAME"; then
    podman build -t "$IMAGE_NAME" -f "$GIT_ROOT/path/to/Dockerfile" "$GIT_ROOT/context"
fi
```

**Container State Management (Persistent Containers):**
```bash
if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
elif podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    exec podman attach "$CONTAINER_NAME"
elif podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    exec podman attach "$CONTAINER_NAME"
fi
```

**Container State Management (One-Shot Containers):**
```bash
if [[ "$FORCE_REBUILD" == true ]]; then
    podman rm -f "$CONTAINER_NAME" 2>/dev/null || true
elif podman ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman exec -it "$CONTAINER_NAME" /workspace/path/to/script.sh
    exit 0
elif podman ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    podman start "$CONTAINER_NAME"
    podman exec -it "$CONTAINER_NAME" /workspace/path/to/script.sh
    exit 0
fi
```

**Podman Run - Interactive Long-Running:**
```bash
podman run -it \
    --name "$CONTAINER_NAME" \
    --userns=keep-id \
    -v "$GIT_ROOT:/workspace" \
    -w /workspace \
    "$IMAGE_NAME"
```

**Podman Run - One-Shot Execution:**
```bash
podman run --rm \
    --name "$CONTAINER_NAME" \
    --userns=keep-id \
    -v "$GIT_ROOT:/workspace" \
    -w /workspace \
    "$IMAGE_NAME"
```

**Required Flags (ALL containers):**
- `--userns=keep-id` - Maps Debian host uid 1000 to container uid 1000
- `-v "$GIT_ROOT:/workspace"` - Mounts git repository root to /workspace
- `-w /workspace` - Sets working directory to /workspace inside container

**Optional Flags:**
- `-it` - Interactive with TTY (for shells, required for interactive)
- `--rm` - Auto-remove on exit (for one-shot tasks, DO NOT use with persistent)
- `-p HOST:CONTAINER` - Port mapping for services
- `-v HOST:CONTAINER:ro` - Additional read-only mounts
- `-v HOST:CONTAINER:rw` - Additional read-write mounts

**Additional Volume Mount Patterns:**
```bash
# User configuration (read-only)
-v "$HOME/.s3cfg:/home/developer/.s3cfg:ro"
-v "$HOME/.aws:/home/developer/.aws:ro"

# Persistent state (read-write)
-v "$HOME/.claude-container:/home/developer/.claude"

# Task-specific data (with environment override)
METADATA_DIR="${METADATA_DIR:-$GIT_ROOT/default/path}"
-v "$METADATA_DIR:/work/metadata:ro"
```

### Naming Conventions

**Container Names:**
- Format: `lowercase-with-hyphens`
- Descriptive of function
- Examples: `portfolio-site-dev-sandbox`, `hls-transcoder`, `image-metadata-tagger`, `bento4-hls`, `site-deploy`

**Image Names:**
- Match container name for simple local images
- Use `localhost/name:tag` for multi-stage or registry-specific builds
- Examples: `hls-transcoder`, `localhost/bento4-hls:latest`

**Launcher Scripts:**
- Format: `launch-{description}.sh` or `launch-{description}-container.sh`
- Executable: `chmod +x launch-*.sh`
- Examples: `launch-dev-container.sh`, `launch-transcode.sh`

### File Organization

**Standard Module Structure:**
```
module-name/
├── Dockerfile              # Container definition
├── launch-*.sh             # Podman orchestration (executable)
├── script.sh               # Processing logic (if applicable)
└── staged/                 # Input staging (if applicable)
```

**Build Context:**
- Smallest context necessary (module directory preferred)
- Use git root only when required
- Example: `podman build -f "$GIT_ROOT/module/Dockerfile" "$GIT_ROOT/module"`

### Security Standards

**Non-Root Execution (MANDATORY):**
- All containers MUST run as non-root user (developer, uid 1000)
- USER directive in Dockerfile enforces this
- Prevents privilege escalation attacks

**Read-Only Mounts:**
- Use `:ro` for configuration files and source code
- Use `:rw` explicitly for output directories
- Default (no suffix) is read-write

**User Namespace Isolation:**
- `--userns=keep-id` provides namespace isolation
- Container uid 1000 maps to Debian host user (uid 1000)
- No root access to host filesystem

### Execution Patterns

**Interactive Shell (Long-Running):**
- Container persists across invocations
- Use `exec podman attach` to rejoin
- Use for: Development, debugging, manual workflows
- Example: Main dev container, HLS metadata shell

**One-Shot Batch (Auto-Remove):**
- Container removed after execution (`--rm`)
- Use `podman exec` for additional commands if needed
- Use for: Transcoding, embedding, deployment
- Example: Transcode, image metadata, publish

**Background Service (Persistent):**
- Long-running daemon or server
- Port exposure via `-p` flag
- Use for: HTTP server, databases
- Example: Development HTTP server

### Adding New Containers - Checklist

When creating new containerized tools:

**1. Select Base Image:**
- [ ] Choose smallest suitable image (Alpine > Language Slim > Debian Slim)
- [ ] Use version-specific tag (NOT :latest or bare version)
- [ ] Verify Alpine availability for required packages
- [ ] Use multi-stage build if compilation required

**2. Dockerfile:**
- [ ] FROM with versioned image (alpine:3.21, python:3.12-slim, etc.)
- [ ] Package installation in single RUN layer with cleanup
- [ ] Developer user with uid 1000, gid 1000
- [ ] USER developer (non-root)
- [ ] WORKDIR /workspace
- [ ] Appropriate CMD or ENTRYPOINT

**3. Launch Script:**
- [ ] `#!/bin/bash` and `set -e`
- [ ] CONTAINER_NAME, IMAGE_NAME, GIT_ROOT variables
- [ ] GIT_ROOT from `git rev-parse --show-toplevel`
- [ ] `--force-rebuild` flag support
- [ ] Image existence check with conditional build
- [ ] Container state management
- [ ] `--userns=keep-id` flag
- [ ] `-v "$GIT_ROOT:/workspace"` mount
- [ ] `-w /workspace` working directory
- [ ] Appropriate execution pattern (interactive / one-shot / service)

**4. Integration:**
- [ ] Script is executable (`chmod +x`)
- [ ] Documented in this CLAUDE.md file
- [ ] Follows project code style (minimal comments)
- [ ] Tested with `--force-rebuild` flag

## Project Overview

Static HTML5 portfolio site for artist Camden Wander, featuring HLS (HTTP Live Streaming) audio/video playback. No build tools, bundlers, or package managers - pure vanilla JavaScript with HLS.js loaded from CDN.

## Development Server

```bash
# Start HTTP server (from site-root directory)
cd /workspace/site-root
python3 -m http.server 8080

# Or use the container (requires Podman)
./launch-dev-container.sh
```

Access at: http://localhost:8080

## Architecture

```
site-root/
├── index.html               # Entry point
├── nope.html                # 404 error page (s3cmd ws-create)
├── css/camden-wander.css    # Styles
├── js/
│   ├── bitmap-background.js # 1-bit GIF background with trigonometric color cycling
│   └── camden-wander.js     # HLS player, track lists, audio analysis
├── img/                     # Artwork images (1-bit GIF bitmaps)
└── hls/
    ├── production/         # Produced tracks
    │   └── {track}/master.m3u8
    ├── mixes/              # DJ mixes
    │   └── {mix}/master.m3u8
    └── live-performances/  # Live performance recordings
        └── {performance}/master.m3u8
```

**Key Flow:** `index.html` loads HLS.js from CDN. `bitmap-background.js` renders animated 1-bit GIF background. `camden-wander.js` builds track lists and handles HLS playback with Web Audio API analysis.

**Cache Busting:** `index.html` contains `CACHE_VERSION` placeholders in CSS and JS URLs (`?v=CACHE_VERSION`). The deployment script replaces these with Unix timestamps to force browser cache invalidation.

**404 Page:** `nope.html` serves as the 404 error page, configured via `s3cmd ws-create` when setting up the S3 bucket for static website hosting.

## Transcoding Workflow

Audio files are transcoded to HLS format using a containerized ffmpeg workflow.

```
transcode/
├── Dockerfile              # Alpine + ffmpeg container
├── launch-transcode.sh     # Container orchestration (--force-rebuild to recreate)
├── generate-hls.sh         # Transcoding script (runs inside container)
└── staged/
    ├── production/         # Drop production track WAVs here
    ├── live-performances/  # Drop live recording WAVs here
    └── mixes/              # Drop DJ mix WAVs here
```

### Usage

```bash
# Place source files in appropriate staged subdirectory, then:
./transcode/launch-transcode.sh

# Force rebuild container if needed
./transcode/launch-transcode.sh --force-rebuild
```

Run from anywhere within the git repo.

### Track Naming Convention

Source files should use **kebab-case** naming (lowercase words separated by hyphens):

```
creeping-insolence.wav      -> "Creeping Insolence"
rude-introduction.wav       -> "Rude Introduction"
my-new-track.wav            -> "My New Track"
```

The folder name becomes the track identifier and is transformed to Title Case for display in the UI.

### Output

Each file is transcoded to 3 bitrate tiers (64k, 128k, 192k AAC) with adaptive bitrate master playlist:

```
site-root/hls/{category}/{track-name}/
├── master.m3u8      # Adaptive bitrate playlist
├── 64k/stream.m3u8  # Low bandwidth
├── 128k/stream.m3u8 # Medium bandwidth
└── 192k/stream.m3u8 # High bandwidth
```

HLS content is organized by category:

```
site-root/hls/
  production/           # Produced tracks
    {track}/
      master.m3u8
      64k/ 128k/ 192k/
  live-performances/    # Live recordings
    {performance}/
      master.m3u8
      64k/ 128k/ 192k/
  mixes/                # DJ mixes
    {mix}/
      master.m3u8
      64k/ 128k/ 192k/
```

### Adding New Tracks

1. Name source file in kebab-case: `my-track-name.wav`
2. Place in appropriate `transcode/staged/{category}/` subdirectory
3. Run `./transcode/launch-transcode.sh`
4. Add folder name to corresponding array in `site-root/js/camden-wander.js`:
   - `producedTracks` for production/
   - `livePerformances` for live-performances/
   - `djMixes` for mixes/

## Metadata Embedding

Containerized metadata embedding tools for site media. Each tool targets a specific media type with appropriate metadata standards.

```
md-embed/
├── image_metadata/                 # Image EXIF/IPTC/XMP embedding
│   ├── Dockerfile                  # Alpine + exiftool + jq
│   ├── images.json                 # Metadata manifest
│   ├── launch-image-metadata-container.sh
│   └── embed-image-metadata.sh
└── hls_metadata/                   # HLS timed ID3 metadata
    ├── Dockerfile                  # Bento4 build (gcc:13 base)
    ├── audio.json                  # Metadata manifest
    └── launch-hls-metadata-container.sh
```

### Image Metadata

Embeds EXIF/IPTC/XMP metadata into artwork images using exiftool.

**Usage:**
```bash
./md-embed/image_metadata/launch-image-metadata-container.sh

# Force rebuild if needed
./md-embed/image_metadata/launch-image-metadata-container.sh --force-rebuild
```

**Manifest:** `site-root/img/images.json`

The manifest is stored alongside the artwork images and defines metadata to be embedded.

```json
{
  "artist": "Artist Name",
  "current_name": "Legal Name (optional)",
  "images": [
    {
      "file": "image.jpg",
      "title": "Title",
      "date": "YYYY-MM-DD",
      "medium": "Medium (optional)",
      "description": "Description (optional)"
    }
  ]
}
```

Supported date formats: YYYY-MM-DD, YYYY-MM, YYYY

Tags artwork with:
- EXIF: DateTimeOriginal, ImageDescription
- IPTC: By-line, ObjectName, DateCreated
- XMP: Creator, Title, Date, Rights, Medium

### HLS Metadata

Injects timed ID3 metadata into HLS MPEG-TS segments using Bento4. Used for DJ mix track attribution where artist/title/Discogs links are embedded at specific timestamps within segments containing copyrighted material.

**Manifest:** `md-embed/hls_metadata/audio.json`

The manifest defines timed ID3 metadata to be injected into HLS segments in `site-root/hls/`.

**Usage:**
```bash
# Create required directories (if using default paths)
mkdir -p md-embed/hls_metadata/metadata
mkdir -p md-embed/hls_metadata/segments
mkdir -p md-embed/hls_metadata/output

# Move audio.json to metadata subdirectory (or override METADATA_DIR)
cp md-embed/hls_metadata/audio.json md-embed/hls_metadata/metadata/

# Place source HLS segments in segments/
# Edit audio.json manifest to define metadata

# Launch container (builds on first run)
./md-embed/hls_metadata/launch-hls-metadata-container.sh

# Force rebuild if needed
./md-embed/hls_metadata/launch-hls-metadata-container.sh --force-rebuild
```

**Container mounts (default paths):**
- /work/metadata (read-only) - Maps to `md-embed/hls_metadata/metadata/` (expects audio.json here)
- /work/segments (read-only) - Maps to `md-embed/hls_metadata/segments/`
- /work/output (read-write) - Maps to `md-embed/hls_metadata/output/`

**Override default paths via environment variables:**
```bash
METADATA_DIR=/path/to/metadata \
SEGMENTS_DIR=/path/to/segments \
OUTPUT_DIR=/path/to/output \
./md-embed/hls_metadata/launch-hls-metadata-container.sh
```

**Bento4 Tools** (available in container at /usr/local/bin/):
- mp42hls - Convert MP4 to HLS with timed metadata
- mp4info - Display MP4/segment information
- mp4dump - Dump container structure

**Metadata JSON Format:**
```json
{
  "version": 1,
  "metadata": [
    {
      "time": 0.0,
      "duration": 330.0,
      "data": {
        "type": "id3",
        "frames": [
          {"id": "TIT2", "value": "Track Title"},
          {"id": "TPE1", "value": "Artist Name"},
          {"id": "TXXX", "description": "DISCOGS_URL", "value": "https://www.discogs.com/release/12345"}
        ]
      }
    },
    {
      "time": 330.0,
      "duration": 45.0,
      "data": {
        "type": "id3",
        "frames": [
          {"id": "TIT2", "value": "Track A / Track B"},
          {"id": "TPE1", "value": "Artist A / Artist B"},
          {"id": "TXXX", "description": "BLEND", "value": "true"}
        ]
      }
    }
  ]
}
```

Fields:
- time: Start time in seconds
- duration: Metadata validity in seconds
- TIT2: Track title (ID3 standard)
- TPE1: Artist (ID3 standard)
- TXXX: Custom frame (description + value)

**ID3 Frame Reference:**

| Frame | Description |
|-------|-------------|
| TIT2  | Title       |
| TPE1  | Artist      |
| TALB  | Album       |
| TDRC  | Year        |
| TCON  | Genre       |
| TXXX  | Custom text |

**Client-Side Playback:**

hls.js exposes ID3 metadata via FRAG_PARSING_METADATA event:

```javascript
hls.on(Hls.Events.FRAG_PARSING_METADATA, (event, data) => {
  data.samples.forEach(sample => {
    sample.data.forEach(frame => {
      if (frame.key === 'TIT2') console.log('Title:', frame.info);
      if (frame.key === 'TPE1') console.log('Artist:', frame.info);
      if (frame.key === 'TXXX') {
        console.log(frame.description + ':', frame.info);
      }
    });
  });
});
```

**License:** Bento4 is GPL v2. Container is for private development use only (not distributed).

### Adding New Metadata Tools

Future metadata embedding mechanisms should follow this pattern:
1. Create subdirectory: `md-embed/{media_type}_metadata/`
2. Include: `Dockerfile`, launcher script, processing script
3. Document usage in this file

## Publishing

Deploys site-root to Linode Object Storage via s3cmd.

```
publish/
├── Dockerfile                  # Debian + ca-certificates + s3cmd, developer user
├── bucket-policy.json          # Public read policy for bucket
├── deploy.sh                   # s3cmd sync with exclusions
└── launch-deploy-container.sh  # Mounts ~/.s3cfg
```

**Deployment:**
```bash
./publish/launch-deploy-container.sh
```

The deployment script (`deploy.sh`) performs multiple operations:
1. Generates cache-busting version (Unix timestamp)
2. Injects version into `index.html` (replaces `CACHE_VERSION` placeholder)
3. Applies `bucket-policy.json` to grant public read access to all objects
4. Syncs files by type with explicit MIME types:
   - `*.css` → `text/css`
   - `*.js` → `application/javascript`
   - `*.html` → `text/html`
   - `*.m3u8` → `application/vnd.apple.mpegurl` (HLS playlists)
   - `*.ts` → `video/mp2t` (HLS segments)
   - Other files → auto-detected via `--guess-mime-type`
5. Restores `CACHE_VERSION` placeholder in `index.html` (keeps git repo clean)
6. All syncs use `--delete-removed` to remove files from S3 that were deleted locally
7. Excludes `*.md` markdown files from deployment

Metadata manifests are stored in `/workspace/md-embed/` and not part of site-root deployment.

**Cache Busting:** CSS and JS files are loaded with `?v=CACHE_VERSION` query strings in `index.html`. During deployment, the placeholder is replaced with the current Unix timestamp, forcing browsers to reload updated assets. The placeholder is restored after deployment to avoid git repository changes.

**Why explicit MIME types?** The `--guess-mime-type` flag doesn't always work correctly on all systems. Syncing by file type with `--mime-type` ensures correct Content-Type headers for browser compatibility.

**Bucket Policy:** The `bucket-policy.json` defines a public read policy allowing anonymous access to all objects in the bucket (required for static website hosting).

**Initial Setup:**
The S3 bucket is configured for static website hosting using `s3cmd ws-create`:
```bash
s3cmd ws-create --ws-index=index.html --ws-error=nope.html s3://camden-wander/
```

This configures `index.html` as the default index page and `nope.html` as the 404 error page.

## External Dependencies

- HLS.js (CDN): `//cdn.jsdelivr.net/npm/hls.js` - adaptive bitrate streaming
- Google Fonts: Orbitron (titles), Rubik (body text)

## Color Scheme

- **Teal** `#008080` / `#00B0B0` - Primary text, borders
- **Purple** `#8400C3` - Accent shadows, active states
- **Yellow** `#FFFF00` - Hover states, timeline
- **Dark background** `#0F0D08`

## UI Design

### Track List Layout

Track lists use SVG-based trapezoid buttons organized in asymmetric groups with responsive flex layout:

- **Releases** - Left-aligned (track-group-left)
- **Performances** - Right-aligned (track-group-right)
- **DJ Mixes (Vinyl)** - Left-aligned (track-group-left)

**Responsive Layout:**
- **Wide screens (> 1080px):** Track groups flex side-by-side with row-gap: 100px between rows
  - Releases (left-aligned)
  - Performances (right-aligned, margin-top: 100px from container top)
  - DJ Mixes wraps to second row with 100px gap from Releases bottom
- **Narrow screens (≤ 1080px):** Track groups stack vertically with 4px gap between groups
  - Performances margin-top removed (uses 4px gap)
- **All screens:** Items maintain their alignment within containers
  - Left-aligned: positioned from left edge, overflow to the right if too wide
  - Right-aligned: positioned from right edge, overflow to the left if too wide
  - Track groups use `flex: min-content` and `max-width: calc(50% - 1rem)` for wrapping behavior

**Dynamic SVG Sizing:**
Each track is rendered as an `<a class="track-item">` containing an SVG with dynamically calculated dimensions:
- Text width measured using OffscreenCanvas (measureSvgTextWidth function)
- Font properties extracted from computed styles of `.track-item svg text` CSS selector
- SVG trapezoid width (svgTrapezoidWidth) = measured text width (svgTextWidth) + 168px (84px padding on each side)
- SVG height = 30px

**Trapezoid Geometry:**
Trapezoids are "rotated 180 degrees" based on alignment:

- **Left-aligned** (track-group-left):
  - Polygon points: `20,30 80,0 ${svgTrapezoidWidth},0 ${svgTrapezoidWidth - 80},30`
  - Slant on left side (narrow top-left, wide bottom-left)
  - Text: x=84, text-anchor=start

- **Right-aligned** (track-group-right):
  - Polygon points: `80,30 0,0 ${svgTrapezoidWidth - 80},0 ${svgTrapezoidWidth},30`
  - Slant on right side (wide bottom-right, narrow top-right)
  - Text: x=(svgTrapezoidWidth - 84), text-anchor=end

Section headers use fixed-width SVGs with the same trapezoid geometry patterns.

**Color Scheme:**
- **Section Headers** (static, no hover): Teal fill (#008080), purple text (#8400C3), Orbitron 24px bold
- **Track Items** (default): Teal fill (#008080), purple text (#8400C3), Orbitron 18px
- **Track Items** (hover): Teal fill with yellow drop shadow (drop-shadow(0 0 8px #FFFF00)), yellow text (#FFFF00), cursor: pointer
- **Track Items** (active/playing): Purple fill (#8400C3) with yellow drop shadow, yellow text (#FFFF00)

### Play/Pause Button

SVG-based trapezoid button matching track item design aesthetic:

- **Geometry:** Fixed 160×30px SVG with polygon points `0,30 60,0 100,0 160,30`
- **Default state:** Purple fill (#8400C3), teal stroke (#00B0B0), bright teal text (#00D0D0)
- **Playing state:** Purple fill (#8400C3), yellow stroke (#FFFF00), yellow text (#FFFF00)
- **Hover:** Flash animation (opacity 1 → 0.5 → 1 at 0.5s interval)
- **Disabled:** 50% opacity, default cursor
- **Text:** Play icon (▶) or Pause icon (⏸), centered via text-anchor: middle

### Timeline

Progress bar with trapezoid clip-path:

- **Geometry:** `clip-path: polygon(0px 0px, 20px 10px, 100% 100%, calc(100% - 20px) 0%)`
- **Background:** Yellow (#FFFF00)
- **Played portion:** Purple (#8400C3)
- **Height:** 10px
- **Behavior:** Click to seek

### Bitmap Background Animation

**Implementation:** 1-bit GIF bitmap from `/workspace/img/` rendered as full-screen background with trigonometric color cycling.

**Current Bitmap:** `pathological-defensive-pessimism.gif`

**Canvas Setup:**
- Absolute position canvas (`#bitmap-bg`) at z-index: -1 (scrolls with page)
- Canvas width matches viewport width
- Canvas height matches full document scroll height (expands to bottom of content)
- 30% opacity for subtle background effect
- `image-rendering: pixelated` to preserve bitmap aesthetic
- Image renders at fixed 2x scale (original pixel size × 2)
- Image centered with negative offsets, cropping edges for blockier aesthetic

**Color Cycling (bitmap-background.js):**
- 20-second period (PERIOD = 20000ms)
- RGB range: 0x00 (minimum) to 0x88 (maximum)
- Starting color: Dark cherry red (#880000)

**Trigonometric Functions:**
- **Red channel:** Cosine wave `r = midpoint + amplitude * cos(phase)`
- **Green channel:** Arccosine transformation `g = midpoint + amplitude * (acos(cos(phase)) / π * 2 - 1)`
- **Blue channel:** Sine wave `b = midpoint + amplitude * sin(phase)`
- Phase = (elapsed time % PERIOD) / PERIOD * 2π

**Rendering:**
- Loads GIF, captures original image data
- Canvas resizes to match viewport width and full document height
- Image renders at fixed 2x scale (not responsive to canvas size)
- Per-frame: applies current color to pixel brightness values
- Uses OffscreenCanvas for color transformation
- requestAnimationFrame for smooth 60fps animation
- Window resize updates canvas dimensions but preserves image scale and aspect ratio

**Future Enhancement:**
- Multiple bitmap layers
- Web Audio API frequency bucket integration (similar to bass bins 4-6)
- Per-layer color and opacity modulation
- Audio-reactive visual experience

## No Build/Test/Lint

This is a static site with no build step, test framework, or linter configured. Changes to HTML/CSS/JS are immediately visible when the server is running.

## Code Style

- Minimal comments; code should be self-documenting
- Comment only for intent or readable explanation of abstract operations (regex, jq filters)
- Shell scripts output tool stdout only; no echo instrumentation unless tool provides no output (e.g., sed)
