# HLS Timed Metadata Injection

Injects timed ID3 metadata into HLS segments using Bento4. Used for DJ mix track attribution where artist/title/Discogs links are embedded at specific timestamps within segments containing copyrighted material.

## Files

- Dockerfile - Multi-stage build: gcc:13 for Bento4 compilation, debian:bookworm-slim runtime
- launch-hls-metadata-container.sh - Container launcher with volume mounts

## Usage

```bash
# Create required directories
mkdir -p md-embed/hls_metadata/metadata
mkdir -p md-embed/hls_metadata/segments

# Place metadata JSON in metadata/
# Place source HLS segments in segments/

# Launch container (builds on first run)
./md-embed/hls_metadata/launch-hls-metadata-container.sh

# Force rebuild if needed
./md-embed/hls_metadata/launch-hls-metadata-container.sh --force-rebuild
```

Container mounts:
- /work/metadata (read-only) - Metadata JSON files
- /work/segments (read-only) - Source HLS segments
- /work/output (read-write) - Output directory

Override directories via environment variables: METADATA_DIR, SEGMENTS_DIR, OUTPUT_DIR

## Bento4 Tools

Available in container at /usr/local/bin/:
- mp42hls - Convert MP4 to HLS with timed metadata
- mp4info - Display MP4/segment information
- mp4dump - Dump container structure

## Metadata JSON Format

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

## ID3 Frame Reference

| Frame | Description |
|-------|-------------|
| TIT2  | Title       |
| TPE1  | Artist      |
| TALB  | Album       |
| TDRC  | Year        |
| TCON  | Genre       |
| TXXX  | Custom text |

## Client-Side Playback

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

## License

Bento4 is GPL v2. Container is for private development use only (not distributed).
