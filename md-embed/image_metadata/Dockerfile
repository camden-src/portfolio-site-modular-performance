FROM alpine:3.21

RUN apk add --no-cache \
    perl \
    perl-image-exiftool \
    exiftool \
    jq \
    bash

WORKDIR /workspace

ENTRYPOINT ["/workspace/md-embed/image_metadata/embed-image-metadata.sh"]
