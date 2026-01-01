#!/bin/bash
set -e

if ! command -v exiftool &> /dev/null; then
    echo "Error: exiftool is not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed"
    exit 1
fi

if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    cat << EOF
Usage: $0

Tag artwork images with metadata from /workspace/site-root/img/images.json

MANIFEST FORMAT:
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
EOF
    exit 0
fi

MANIFEST="/workspace/site-root/img/images.json"

if [[ ! -f "$MANIFEST" ]]; then
    echo "Error: Manifest file not found: $MANIFEST"
    exit 1
fi

MANIFEST_DIR=$(dirname "$MANIFEST")
ARTIST=$(jq -r '.artist // empty' "$MANIFEST")
CURRENT_NAME=$(jq -r '.current_name // empty' "$MANIFEST")

if [[ -z "$ARTIST" ]]; then
    echo "Error: artist is required in manifest"
    exit 1
fi

tag_image() {
    local file="$1"
    local title="$2"
    local date_exif="$3"
    local date_iptc="$4"
    local date_xmp="$5"
    local year="$6"
    local medium="$7"
    local description="$8"

    local cmd=(exiftool -overwrite_original_in_place)

    cmd+=(-Artist="$ARTIST")
    cmd+=(-Copyright="© $year $ARTIST")
    cmd+=(-ImageDescription="$title")
    cmd+=(-DateTimeOriginal="$date_exif")
    cmd+=(-IPTC:By-line="$ARTIST")
    cmd+=(-IPTC:ObjectName="$title")
    cmd+=(-IPTC:DateCreated="$date_iptc")
    cmd+=(-IPTC:CopyrightNotice="© $year $ARTIST")
    cmd+=(-IPTC:Category="Artwork")
    cmd+=(-XMP:Creator="$ARTIST")
    cmd+=(-XMP:Title="$title")
    cmd+=(-XMP:Date="$date_xmp")
    cmd+=(-XMP:Rights="© $year $ARTIST")

    [[ -n "$medium" ]] && cmd+=(-XMP:Medium="$medium")
    [[ -n "$CURRENT_NAME" ]] && cmd+=(-XMP-plus:Licensor="$CURRENT_NAME" -IPTC:Contact="$CURRENT_NAME")
    [[ -n "$description" ]] && cmd+=(-IPTC:Caption-Abstract="$description" -XMP:Description="$description")

    cmd+=("$file")
    "${cmd[@]}" 2>/dev/null
}

count=$(jq '.images | length' "$MANIFEST")

for i in $(seq 0 $((count - 1))); do
    img_file=$(jq -r ".images[$i].file // empty" "$MANIFEST")
    img_title=$(jq -r ".images[$i].title // empty" "$MANIFEST")
    img_date=$(jq -r ".images[$i].date // empty" "$MANIFEST")
    img_medium=$(jq -r ".images[$i].medium // empty" "$MANIFEST")
    img_desc=$(jq -r ".images[$i].description // empty" "$MANIFEST")

    [[ -z "$img_file" ]] && continue
    full_path="$MANIFEST_DIR/$img_file"
    [[ ! -f "$full_path" ]] && continue
    [[ -z "$img_date" ]] && continue

    if [[ "$img_date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        date_exif="${img_date//-/:} 00:00:00"
        date_iptc="${img_date//-/:}"
        date_xmp="$img_date"
        year="${img_date:0:4}"
    elif [[ "$img_date" =~ ^[0-9]{4}-[0-9]{2}$ ]]; then
        date_exif="${img_date//-/:}:01 00:00:00"
        date_iptc="${img_date//-/:}:01"
        date_xmp="$img_date-01"
        year="${img_date:0:4}"
    elif [[ "$img_date" =~ ^[0-9]{4}$ ]]; then
        date_exif="$img_date:01:01 00:00:00"
        date_iptc="$img_date:01:01"
        date_xmp="$img_date-01-01"
        year="$img_date"
    else
        continue
    fi

    tag_image "$full_path" "$img_title" "$date_exif" "$date_iptc" "$date_xmp" "$year" "$img_medium" "$img_desc"
done
