FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    s3cmd \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 developer
USER developer
WORKDIR /workspace

ENTRYPOINT ["/workspace/publish/deploy.sh"]
