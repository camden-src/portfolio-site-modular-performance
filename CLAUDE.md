# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Container Environment

Claude Code runs inside a container. The /workspace/ directory is a host directory mounted into the container. Git operations (commit, push, pull, branch management) are performed by the user on the container host, not by Claude. Do not execute git commands; file changes made in /workspace/ will be visible to the host user for version control.

### Claude Code Container Launcher

A generalized Claude Code container launcher is available at the repository root:

```bash
# Launch Claude Code container (prompts for workspace directory)
./launch-claude-code-container.sh

# Force rebuild if needed
./launch-claude-code-container.sh --force-rebuild
```

The launcher:
- Prompts for a host directory to mount as `/workspace` (supports tab-completion)
- Generates a unique container name based on the workspace path
- Allows multiple container instances for different projects simultaneously
- Container name format: `claude-code-{dirname}-{hash}`

This allows working on multiple projects in separate container sessions.

## Container Standards

**Portfolio Site Containers:**
- **Development Server:** Apache httpd (Alpine-based, serves site-root on port 8080)
- **Deployment:** Debian slim with s3cmd (publishes to Linode Object Storage)

## Project Overview

Static HTML5 portfolio site for electronic music artist Camden Wander, featuring live performances of original compositions created with Eurorack modular synthesizers and other hardware instruments. HLS (HTTP Live Streaming) audio playback facilitated with HLS.js loaded from CDN.

**Site Purpose:** Demonstrate ability to provide live performances of electronic music with hardware synthesizers as entertainment.

## Development Server

The portfolio site uses an Apache httpd container for local development:

```bash
# Start development server
./site-root/dev-server/launch-server.sh

# Force rebuild container if needed
./site-root/dev-server/launch-server.sh --force-rebuild

# Stop server
podman stop portfolio-site-dev-server

# Remove container
podman rm portfolio-site-dev-server
```

The server mounts `site-root/` to `/usr/local/apache2/htdocs/synth-performance` and serves on port 8080.

## Architecture

```
site-root/
├── index.html                   # Home page
├── nope.html                    # 404 error page (s3cmd ws-create)
├── css/camden-wander.css
├── js/camden-wander.js          # HLS player, track lists from JSON, info panel toggle
├── img/                         # Images
└── hls/
    └── {track_name}/master.m3u8 # HLS trancoded audio manifests and ts segments at 3 bit rates
```

**Key Flow:** `index.html` loads HLS.js from CDN and contains static track listings. `camden-wander.js` handles info panel toggles, HLS playback, and timeline updates.

**Static Architecture:** Track listings are written directly in `index.html` as `<li>` elements. JavaScript attaches event listeners to these static elements for interactivity. Track metadata in `tracks.json` is reference data only.

**Cache Busting:** `index.html` contains `CACHE_VERSION` placeholders in CSS and JS URLs (`?v=CACHE_VERSION`). The deployment script replaces these with Unix timestamps to force browser cache invalidation.

**404 Page:** `nope.html` serves as the 404 error page, configured via `s3cmd ws-create` when setting up the S3 bucket for static website hosting.

## Track Management

### Track Metadata (tracks.json)

All track information is currently stored in `/workspace/site-root/data/tracks.json`:

```json
{
  "movements": [
    {
      "id": "track-name",
      "title": "Track Name",
      "hlsPath": "hls/{track-id}/master.m3u8",
      "info": {
        "dateRecorded": "YYYY-MM-DD",
        "duration": "M:SS",
        "style": "genre, tags"
      }
    }
  ],
  "livePerformances": [
    {
      "id": "performance-name",
      "title": "Performance Name",
      "hlsPath": "hls/{track-id}/master.m3u8",
      "info": {
        "dateRecorded": "YYYY-MM-DD",
        "venue": "Venue Name, City ST",
        "duration": "MM:SS",
        "style": "genre, tags"
      }
    }
  ]
}
```
**[COMPLETED 2026-01-08]:** Refactored from dynamic JS track generation to static HTML track listings. Track data is now manually maintained in `index.html` as `<li class="track-item">` and `<li class="track-info-panel">` elements.

## Publishing

Deploys site-root to Linode Object Storage via s3cmd.

```
publish/
├── Containerfile               # Debian + ca-certificates + s3cmd, developer user
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
   - `*.json` → `application/json`
   - `*.m3u8` → `application/vnd.apple.mpegurl` (HLS playlists)
   - `*.ts` → `video/mp2t` (HLS segments)
   - Other files → auto-detected via `--guess-mime-type`
5. Restores `CACHE_VERSION` placeholder in `index.html` (keeps git repo clean)
6. All syncs use `--delete-removed` to remove files from S3 that were deleted locally
7. Excludes `*.md` markdown files from deployment

**Cache Busting:** CSS and JS files are loaded with `?v=CACHE_VERSION` query strings in `index.html`. During deployment, the placeholder is replaced with the current Unix timestamp, forcing browsers to reload updated assets. The placeholder is restored after deployment to avoid git repository changes.

**Bucket Policy:** The `bucket-policy.json` defines a public read policy allowing anonymous access to all objects in the bucket (required for static website hosting).

**Initial Setup:**
The S3 bucket is configured for static website hosting using `s3cmd ws-create`:
```bash
s3cmd ws-create --ws-index=index.html --ws-error=nope.html s3://camden-wander/
```

## External Dependencies

- HLS.js (CDN): `//cdn.jsdelivr.net/npm/hls.js` - adaptive bitrate streaming
- Google Fonts: Orbitron (titles, section headers, player controls), Rubik (track titles, info panels, body text)

## Color Scheme

- **`#00273D`** "Dark ocean" in Canva
  - Page background
  - Title text "Camden Wander"
  - Section heading text "Movements" and "Live Performances"
  - Info panel and "hide X" control
- **`#31EDAE`** "Soft teal" in Canva
  - Title SVG polygon background fill
  - Section headers SVG polygon fill
- **`#5E17EB`** "Violet" in Canva
  - Subtitle SVG polygon fill
  - Track listing SVG polygon fill
  - Timeline "played portion" SVG polygon fill
  - Main player control text/icon
- **`#FF5757`** "Coral red" in Canva
  - Title SVG polygon stroke
  - Section headings SVG polygon stroke
  - Info panels SVG polygon stroke
  - Main player control SVG polygon stroke
  - Borders, active track accents, play button (playing state)
- **`#FFF3C2`** "Light lemon" in Canva
  - Info panel SVG polygon fill
  - Timeline "queued portion" SVG polygon fill
  - `.track-item` class `color:` attribute: all text in track-item

## UI Layout

General pattern is a parent <div> element contains one or more SVG polygon elements a visual containers. SVG polygons are styled with fill and stroke.

SVG polygons contain <foreignObject> elements with additional HTML markup. HTML elements inside these <foreignObjects> have ids and classes to associate with css style directives.

### Title

Centered regardless of horizontal window size.

### Headline (formerly Subtitle)

Centered regardless of horizontal window size. 

### Track List Sections

Two sections: "Movements" and "Live Performance"

When window >1080px, sections are side-by-side, each section with uniform 40px padding to window center.

When window ≤1080px, sections are centered and stacked vertically, with "Movements" above "Live Performances".

### Track Listing

**[COMPLETED 2026-01-08]:** Track listings now use static `<li>` elements:
- Each track has `<li class="track-item">` with data attributes (`data-id`, `data-src`)
- Contains `<a class="track-queuer">` (play icon), `<a class="track-info-toggle">` (info icon), and `<span class="track-name">` (title)
- Each track has companion `<li class="track-info-panel">` with `data-track-id` attribute
- Info panels are `display: none` by default, revealed with max-height animation

### Info Panels

Toggleable dropdown panels below each item containing an anchor including a class suffixed with "-info-toggle":

- Animate reveal of info pannel, with the appearance that it is descending "bottom first" from the element containing the activated "info" button like an old projector screen
- Animate obfuscation of info panel, with the appearance that it is ascending, disappearing "top first" behind the element with the associated "info" button
- Hide control ("hide" +  "X") with margin-top: 4px and margin-right: 4px: use Rubik for "hide" with text-decoration, Orbitron for "X" with no text decoration
- Rubik medium font for info panel prose
- Clicking the icon info in the "activating element" or the "hide X" link toggles visibility
- Other page elements shift down when info panel opens
- Toggleable info page elements are static items, rendered on load, but hidden until activated

**[COMPLETED 2026-01-08]:** Info panels implemented with:
- Max-height CSS transitions for "projector screen" reveal/hide animation
- `<a class="info-panel-close">` with "hide X" control
- Toggle via info icon or close control
- Static elements rendered on load, hidden by default

### Play/Pause Button

SVG-based trapezoid button:

- **Hover:** Flashing animation
- **Disabled:** 50% opacity
- Orbitron font, 24px
- Current visible "control" toggles between the Unicode "play symbol" and "pause" symbol depending on state of player

### Timeline

Progress bar with trapezoid clip-path:

- **Background:** Light lemon (#FFF3C2)
- **Played portion:** Purple (#5E17EB)
- **Height:** 30px
- **Behavior:** Click to seek
- **Dynamic Text:**
  - Track data is superimposed on the timeline, vertically aligned in the middle of the timeline, with track name and duration appearing "mirrored" with respect to the right edge of the "played" element
  - Played section (right-justified with a 16px margin-right to container): Track title (sourced from HLS reading segment metadata) + duration played
  - Unplayed section (left-justified to right edge of "time-played" element, 16px padding-left to current right edge of "played" element): Duration remaining + track title (sourced from HLS reading segment metadata)
  - Text appears/disappears based on available space (overflow is clipped on each side)
  - Orbitron font, 12px

**[COMPLETED 2026-01-08]:** Timeline text displays track title on both sides:
- Played portion (right side): "Title -2:30" (time remaining with minus sign)
- Unplayed portion (left side): "5:23 Title" (time played without minus sign)
- Text visibility based on available width (120px threshold)

## No Build/Test/Lint

This is a static site with no build step, test framework, or linter configured. Changes to HTML/CSS/JS are immediately visible when the server is running.

## Code Style

- Minimal comments; code should be self-documenting
- Comment only for intent or readable explanation of abstract operations (regex, jq filters)
- Shell scripts output tool stdout only; no echo instrumentation unless tool provides no output (e.g., sed)

