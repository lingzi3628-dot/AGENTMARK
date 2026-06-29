#!/bin/bash
# Keep the Next.js dev server alive — restart if it dies.
cd /home/z/my-project
if ! pgrep -f "next dev -p 3000" >/dev/null 2>&1; then
  setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 > dev.log 2>&1' </dev/null >/dev/null 2>&1 &
fi
