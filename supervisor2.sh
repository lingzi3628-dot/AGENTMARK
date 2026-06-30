#!/bin/bash
# Supervisor: keeps both the Next.js dev server AND the Telegram polling bridge alive.
# Restart if either dies. Fully detached from the calling shell.
cd /home/z/my-project

LOG="/home/z/my-project/supervisor.log"
TELEGRAM_TOKEN="8955958395:AAHHV5BKO0JMKL5ng-aMPIfyn1yUnPNleSo"

# Get the integration ID for Telegram (if it exists)
get_integ_id() {
  AGENT_ID=$(curl -s http://localhost:3000/api/agents 2>/dev/null | python3 -c "import sys,json;a=json.load(sys.stdin);print(a[0]['id'] if a else '')" 2>/dev/null)
  if [ -z "$AGENT_ID" ]; then
    echo ""
    return
  fi
  curl -s "http://localhost:3000/api/agents/$AGENT_ID/integrations" 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);print([i['id'] for i in d if i['platform']=='telegram'][0] if any(i['platform']=='telegram' for i in d) else '')" 2>/dev/null
}

while true; do
  # 1. Keep Next.js alive
  if ! pgrep -f "next dev -p 3000" >/dev/null 2>&1; then
    setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1' </dev/null >/dev/null 2>&1 &
    echo "[$(date +%H:%M:%S)] started next dev" >> "$LOG"
    sleep 5
  fi

  # 2. Keep Telegram polling bridge alive
  INTEG_ID=$(get_integ_id)
  if [ -n "$INTEG_ID" ] && ! pgrep -f "telegram-poll" >/dev/null 2>&1; then
    # Export the integration ID for the poll script
    export TELEGRAM_INTEG_ID="$INTEG_ID"
    setsid bash -c "TELEGRAM_INTEG_ID='$INTEG_ID' bash telegram-poll.sh >> telegram-poll.log 2>&1" </dev/null >/dev/null 2>&1 &
    echo "[$(date +%H:%M:%S)] started telegram-poll (integ=$INTEG_ID)" >> "$LOG"
  fi

  sleep 10
done
