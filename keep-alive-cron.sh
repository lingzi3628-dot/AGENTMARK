#!/bin/bash
# Keep-alive script — called by cron every 2 minutes.
# Restarts the Next.js server and Telegram polling bridge if they're dead.
cd /home/z/my-project

# Start Next.js if dead
if ! pgrep -f "next dev -p 3000" >/dev/null 2>&1; then
  setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1' </dev/null >/dev/null 2>&1 &
  echo "[$(date)] restarted next dev" >> keep-alive.log
fi

# Start Telegram polling bridge if dead (and integration exists)
AGENT_ID=$(curl -s http://localhost:3000/api/agents 2>/dev/null | python3 -c "import sys,json;a=json.load(sys.stdin);print(a[0]['id'] if a else '')" 2>/dev/null)
if [ -n "$AGENT_ID" ]; then
  INTEG_ID=$(curl -s "http://localhost:3000/api/agents/$AGENT_ID/integrations" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print([i['id'] for i in d if i['platform']=='telegram'][0] if any(i['platform']=='telegram' for i in d) else '')" 2>/dev/null)
  if [ -n "$INTEG_ID" ] && ! pgrep -f "telegram-poll" >/dev/null 2>&1; then
    setsid bash -c "TELEGRAM_INTEG_ID='$INTEG_ID' bash telegram-poll.sh >> telegram-poll.log 2>&1" </dev/null >/dev/null 2>&1 &
    echo "[$(date)] restarted telegram-poll (integ=$INTEG_ID)" >> keep-alive.log
  fi
fi
