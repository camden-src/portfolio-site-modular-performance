# Metadata Embedding (md-embed/)

Containerized metadata embedding tools for site media. Each tool targets a specific media type with appropriate metadata standards.

## Code Style

- Minimal comments; code should be self-documenting
- Comment only for intent or readable explanation of abstract operations (regex, jq filters)
- Shell scripts output tool stdout only; no echo instrumentation unless tool provides no output (e.g., sed)

## Tools

### Image Metadata (`image_metadata/`)

Embeds EXIF/IPTC/XMP metadata into artwork images using exiftool.

**Files:**
- `Dockerfile` - Alpine container with exiftool and jq
- `launch-image-metadata-container.sh` - Container launcher (`--force-rebuild` to recreate)
- `embed-image-metadata.sh` - Tagging script (reads manifest from `site-root/img/images.json`)

**Usage:**
```bash
./md-embed/image_metadata/launch-image-metadata-container.sh
```

**Manifest:** `site-root/img/images.json`
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

### HLS Metadata (`hls_metadata/`)

Injects timed ID3 metadata into HLS MPEG-TS segments using Bento4. Used for DJ mix track attribution embedded directly in segments containing copyrighted material.

**Files:**
- `Dockerfile` - Bento4 build container (gcc:13 base, GPL v2)
- `launch-hls-metadata-container.sh` - Interactive shell launcher
- `CLAUDE.md` - Full workflow documentation

**Usage:**
```bash
# Build container (one time)
podman build -t localhost/bento4-hls:latest -f md-embed/hls_metadata/Dockerfile md-embed/hls_metadata

# Launch interactive session
./md-embed/hls_metadata/launch-hls-metadata-container.sh
```

See `hls_metadata/CLAUDE.md` for complete workflow including metadata JSON format and client-side playback integration.

## Adding New Metadata Tools

Future metadata embedding mechanisms should follow this pattern:
1. Create subdirectory: `md-embed/{media_type}_metadata/`
2. Include: `Dockerfile`, launcher script, processing script
3. Document usage in this file and tool-specific `CLAUDE.md` if needed
