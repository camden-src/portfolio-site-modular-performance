# HLS Transcoder

Transcodes audio/video files to HLS format with adaptive bitrate streaming using ffmpeg in a container.

## Usage

```bash
# Place source files in appropriate staged subdirectory:
#   transcode/staged/production/
#   transcode/staged/live-performances/
#   transcode/staged/mixes/

# Run from anywhere within the git repo
./transcode/launch-transcode.sh

# Force rebuild container if needed
./transcode/launch-transcode.sh --force-rebuild
```

## Track Naming Convention

Source files should use **kebab-case** naming (lowercase words separated by hyphens):

```
creeping-insolence.wav      -> "Creeping Insolence"
rude-introduction.wav       -> "Rude Introduction"
my-new-track.wav            -> "My New Track"
```

The folder name becomes the track identifier and is transformed to Title Case for display in the UI.

## Adding New Tracks

1. Name source file in kebab-case: `my-track-name.wav`
2. Place in appropriate `transcode/staged/{category}/` subdirectory
3. Run `./transcode/launch-transcode.sh`
4. Add folder name to corresponding array in `site-root/js/camden-wander.js`:
   - `producedTracks` for production/
   - `livePerformances` for live-performances/
   - `djMixes` for mixes/

## Files

- `Dockerfile` - Alpine container with ffmpeg
- `launch-transcode.sh` - Podman launch script (--force-rebuild to recreate)
- `generate-hls.sh` - Transcoding script that runs inside the container

## Output

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

Each category outputs 3 bitrate tiers (64k, 128k, 192k AAC) with adaptive bitrate master playlist.
