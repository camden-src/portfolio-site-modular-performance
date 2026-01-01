#!/bin/bash

cd /workspace/site-root
python3 -m http.server 8080 &
echo "HTTP server started on port 8080"

# Keep container running with interactive shell
exec /bin/bash

