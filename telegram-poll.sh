#!/bin/bash
# Telegram long-polling bridge — fetches updates from Telegram and forwards
# them to our webhook endpoint. This works without HTTPS (unlike webhooks).
# Run this in the background: setsid bash telegram-poll.sh &

cd /home/z/my-project

TOKEN="8955958395:AAHHV5BKO0JMKL5ng-aMPIfyn1yUnPNleSo"
INTEG_ID="cmr064km80001n6smsncy781j"
WEBHOOK_URL="http://localhost:3000/api/webhooks/telegram?i=$INTEG_ID"
OFFSET=0

echo "[poll] Starting Telegram long-polling bridge for @Agentmark_test_bot"
echo "[poll] Webhook target: $WEBHOOK_URL"

# Delete any existing webhook so getUpdates works
curl -s -X POST "https://api.telegram.org/bot$TOKEN/deleteWebhook" >/dev/null 2>&1

while true; do
  # Long-poll: wait up to 30 seconds for new updates
  UPDATES=$(curl -s --max-time 35 "https://api.telegram.org/bot$TOKEN/getUpdates?offset=$OFFSET&timeout=30&allowed_updates=%5B%22message%22%5D" 2>/dev/null)

  # Parse and process each update
  COUNT=$(echo "$UPDATES" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    if not d.get('ok'):
        print(0)
        sys.exit()
    updates = d.get('result', [])
    for u in updates:
        uid = u['update_id']
        msg = u.get('message', {})
        chat_id = msg.get('chat', {}).get('id', 0)
        text = msg.get('text', '')
        first_name = msg.get('chat', {}).get('first_name', 'User')
        print(f'{uid}|{chat_id}|{first_name}|{text}')
except Exception as e:
    sys.stderr.write(str(e) + '\n')
    print(0)
" 2>/dev/null)

  if [ -z "$COUNT" ] || [ "$COUNT" = "0" ]; then
    continue
  fi

  while IFS='|' read -r UPD_ID CHAT_ID FNAME TEXT; do
    [ -z "$UPD_ID" ] && continue
    echo "[poll] Processing: update=$UPD_ID chat=$CHAT_ID text='$TEXT'"

    # Forward to our webhook (runs the agent + sends reply)
    PAYLOAD=$(python3 -c "
import json
print(json.dumps({'update_id': $UPD_ID, 'message': {'message_id': 1, 'chat': {'id': $CHAT_ID, 'type': 'private', 'first_name': '$FNAME'}, 'text': '''$TEXT'''}}))
" 2>/dev/null)

    curl -s -X POST "$WEBHOOK_URL" \
      -H "content-type: application/json" \
      -d "$PAYLOAD" \
      --max-time 30 >/dev/null 2>&1

    echo "[poll] Done processing update $UPD_ID"

    OFFSET=$((UPD_ID + 1))
  done <<< "$COUNT"

done
