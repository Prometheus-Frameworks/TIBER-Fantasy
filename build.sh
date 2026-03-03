#!/bin/sh
# Build server bundle to dist/app.mjs (NOT index.mjs)
# Then copy bootstrap as dist/index.mjs so "node dist/index.mjs" runs the
# tiny bootstrap first, binding the port before the big bundle loads.
./node_modules/.bin/esbuild server/index.ts \
  --platform=node \
  --bundle \
  --packages=external \
  --format=esm \
  --outfile=dist/app.mjs \
  && npx vite build \
  && cp server/bootstrap.mjs dist/index.mjs
