#!/bin/bash
# Supervisor: keeps the Next.js dev server alive indefinitely.
# Restarts next dev if it dies. Fully detaches from the calling shell.
cd /home/z/my-project
while true; do
  if ! pgrep -f "next dev -p 3000" >/dev/null 2>&1; then
    setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1' </dev/null >/dev/null 2>&1 &
    echo "[$(date +%H:%M:%S)] restarted next dev" >> /home/z/my-project/supervisor.log
  fi
  sleep 15
done
