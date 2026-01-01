# portfolio-site

Static HTML5 portfolio site for an artist, featuring HLS (HTTP Live Streaming) audio/video playback with a WebGL animated background.

## Architecture

The site runs without build tools, bundlers, or package managers. HLS.js and Three.js load from CDN. The WebGL background renders descending artwork in copper frames with bass-synced rotation driven by Web Audio API analysis.

```
site-root/
├── index.html
├── css/camden-wander.css
├── js/
│   ├── camden-wander.js      # HLS player, track lists, audio analysis
│   └── webgl-background.js   # Three.js animated background
└── hls/
    ├── production/           # Produced tracks
    ├── mixes/                # DJ mixes
    └── live-performances/    # Live recordings
```

## Development Container

The development environment runs in a Podman container with an HTTP server and Claude Code pre-installed.

```bash
./launch-dev-container.sh
```

The container:
- Serves the site on port 8080
- Provides an interactive shell for development
- Mounts the repository at /workspace
- Runs as a non-root developer user

### LLM Integration and Sandboxing

Claude Code is installed inside the container via the official install script. The LLM operates within the container's isolation boundary:

- Container runs with user namespace isolation (--userns=keep-id)
- No privileged access to the host system
- Network access limited to mapped ports (8080 for HTTP server)
- Filesystem access restricted to mounted volumes (/workspace and Claude config)
- The .claude directory is mounted from a dedicated host path (~/.claude-container) to isolate credentials from the host's primary Claude configuration

This architecture allows the LLM to assist with code exploration, editing, and shell commands while preventing access to host resources outside the explicitly mounted paths. The container provides a reproducible environment where LLM-suggested commands execute in isolation from the developer's primary system.

CLAUDE.md files throughout the repository provide context to the LLM about project structure, workflows, and coding conventions without requiring manual explanation each session.

## Transcoding Workflow

Audio files are transcoded to HLS format using a containerized ffmpeg workflow.

```bash
# Place source WAV in appropriate staged subdirectory
cp track.wav transcode/staged/production/

# Run transcoder
./transcode/launch-transcode.sh
```

Output structure per track:
```
hls/{category}/{track-name}/
├── master.m3u8      # Adaptive bitrate playlist
├── 64k/stream.m3u8  # Low bandwidth tier
├── 128k/stream.m3u8 # Medium bandwidth tier
└── 192k/stream.m3u8 # High bandwidth tier
```

After transcoding, add the track folder name to the corresponding array in js/camden-wander.js.

## Metadata Embedding

Two containerized tools handle metadata embedding for site media.

### Image Metadata

Embeds EXIF/IPTC/XMP metadata into artwork images using exiftool. Reads a manifest at site-root/img/images.json containing artist info and per-image metadata.

```bash
./md-embed/image_metadata/launch-image-metadata-container.sh
```

### HLS Timed Metadata

Injects timed ID3 metadata into HLS segments using Bento4. Used for DJ mix track attribution where artist/title/Discogs links are embedded at specific timestamps within segments containing copyrighted material.

```bash
./md-embed/hls_metadata/launch-hls-metadata-container.sh
```

The Bento4 container builds from source (GPL v2 licensed) and provides an interactive shell for metadata injection workflows.

## Publishing

Deploys site-root to Linode Object Storage via s3cmd.

```bash
./publish/launch-deploy-container.sh
```

Requires s3cmd configuration at ~/.s3cfg on the host. The container mounts this config read-only and syncs site-root to the configured bucket with public-read ACL.

## External Dependencies

- HLS.js (CDN) - Adaptive bitrate streaming
- Three.js (CDN) - WebGL 3D graphics
- Google Fonts - Orbitron (titles), Rubik (body)

## Container Requirements

All workflows use Podman. Each container:
- Builds from a Dockerfile in its directory
- Uses --userns=keep-id for file permission alignment
- Supports --force-rebuild flag to recreate the image

No Docker daemon required. Containers are rootless and run under the invoking user's namespace.
