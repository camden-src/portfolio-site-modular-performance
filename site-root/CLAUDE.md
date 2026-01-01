# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
├── css/camden-wander.css    # Styles
├── js/
│   ├── camden-wander.js     # HLS player, track lists, audio analysis
│   └── webgl-background.js  # Three.js animated background
└── hls/
    ├── production/         # Produced tracks
    │   └── {track}/master.m3u8
    ├── mixes/              # DJ mixes
    │   └── {mix}/master.m3u8
    └── live-performances/  # Live performance recordings
        └── {performance}/master.m3u8
```

**Key Flow:** `index.html` loads HLS.js and Three.js from CDN. `webgl-background.js` renders descending artwork frames with bass-synced rotation. `camden-wander.js` builds track lists and handles HLS playback with Web Audio API analysis for the animation.

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

**Usage:**
```bash
# Place source audio in appropriate staged subdirectory, then:
./transcode/launch-transcode.sh

# Force rebuild container if needed:
./transcode/launch-transcode.sh --force-rebuild
```

**Output:** Each file is transcoded to 3 bitrate tiers (64k, 128k, 192k) with adaptive bitrate master playlist:
```
hls/{category}/{track-name}/
├── master.m3u8      # Adaptive bitrate playlist
├── 64k/stream.m3u8  # Low bandwidth
├── 128k/stream.m3u8 # Medium bandwidth
└── 192k/stream.m3u8 # High bandwidth
```

**After transcoding:** Add track folder names to the corresponding array in `js/camden-wander.js`.

## Metadata Embedding (md-embed/)

Containerized metadata embedding tools for site media. See `md-embed/CLAUDE.md` for detailed documentation.

```
md-embed/
├── CLAUDE.md                       # Tool overview and usage
├── image_metadata/                 # Image EXIF/IPTC/XMP embedding
│   ├── Dockerfile                  # Alpine + exiftool + jq
│   ├── launch-image-metadata-container.sh
│   └── embed-image-metadata.sh
└── hls_metadata/                   # HLS timed ID3 metadata
    ├── Dockerfile                  # Bento4 build (gcc:13 base)
    ├── launch-hls-metadata-container.sh
    └── CONTEXT.md                  # Full workflow documentation
```

**Image Metadata:** Tags artwork with EXIF/IPTC/XMP using manifest at `site-root/img/images.json`.
```bash
./md-embed/image_metadata/launch-image-metadata-container.sh
```

**HLS Metadata:** Injects timed ID3 metadata into HLS segments for DJ mix track attribution.
```bash
./md-embed/hls_metadata/launch-hls-metadata-container.sh
```

## Publishing (publish/)

Deploys site-root to Linode Object Storage via s3cmd.

```
publish/
├── Dockerfile                  # Debian + s3cmd, developer user
├── bucket-policy.json          # Public read policy for bucket
├── deploy.sh                   # s3cmd sync with exclusions
└── launch-deploy-container.sh  # Mounts ~/.s3cfg
```

```bash
./publish/launch-deploy-container.sh
```

## External Dependencies

- HLS.js (CDN): `//cdn.jsdelivr.net/npm/hls.js` - adaptive bitrate streaming
- Three.js (CDN): `//cdn.jsdelivr.net/npm/three@0.160.0` - WebGL 3D graphics
- Google Fonts: Orbitron (titles), Rubik (body text)

## Color Scheme

- **Teal** `#008080` - Primary text, borders
- **Purple** `#9400D3` - Accent shadows, active states
- **Gold** `#FFD700` / `#CC9900` - Hover states, timeline
- **Dark background** `#0F0D08`
- **Copper frames** `#B87333` - WebGL picture frames

## WebGL Animation

- Descending artwork with copper beveled frames
- Wide spotlight illumination from camera position
- Bass-synced Y-axis rotation (bins 4-6), 1 rotation/sec default
- Rule of thirds: rotate in top/bottom thirds, pause facing camera in middle

## No Build/Test/Lint

This is a static site with no build step, test framework, or linter configured. Changes to HTML/CSS/JS are immediately visible when the server is running.

## Code Style

- Minimal comments; code should be self-documenting
- Comment only for intent or readable explanation of abstract operations (regex, jq filters)
- Shell scripts output tool stdout only; no echo instrumentation unless tool provides no output (e.g., sed)
