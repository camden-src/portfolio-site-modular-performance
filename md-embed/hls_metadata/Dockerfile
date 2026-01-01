# Bento4 HLS Metadata Injection Container
# GPL v2 licensed toolkit for MPEG/HLS manipulation
# https://github.com/axiomatic-systems/Bento4

FROM docker.io/library/gcc:13 AS builder

# gcc image includes g++, make; add cmake and git
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
RUN git clone --depth 1 https://github.com/axiomatic-systems/Bento4.git

WORKDIR /build/Bento4
RUN cmake -DCMAKE_BUILD_TYPE=Release . && \
    make -j$(nproc)

# Create minimal runtime image
FROM docker.io/library/debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/Bento4/bin /usr/local/bin/

WORKDIR /work

# Verifies installation
RUN mp42hls --help || true && \
    mp4info --help || true

CMD ["/bin/bash"]
