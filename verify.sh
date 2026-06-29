#!/bin/bash
# Self-contained verification: start server, run full agent, capture results.
set +e
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 1
rm -f dev.log
setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 > dev.log 2>&1' </dev/null >/dev/null 2>&1 &
disown

# wait for boot
for i in $(seq 1 25); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && { echo "server up ${i}s"; break; }
  sleep 1
done

# clear onboarding + open
agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser eval "localStorage.setItem('giselle.onboarded','1')" >/dev/null 2>&1

# Click sidebar "Run" nav (4th button in the WORKSPACE section)
RUNNAV=$(agent-browser snapshot -i 2>&1 | grep -E '^\- button "Run" \[ref=' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
echo "sidebar run nav: $RUNNAV"
agent-browser click "$RUNNAV" >/dev/null 2>&1
agent-browser wait 1500 >/dev/null 2>&1
echo "view after click: $(agent-browser eval 'document.querySelector("h1")?.innerText' 2>/dev/null | tail -1)"

# Pick first agent
PICK=$(agent-browser snapshot -i 2>&1 | grep -E 'nodes"' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
echo "picker: $PICK"
agent-browser click "$PICK" >/dev/null 2>&1
agent-browser wait 1200 >/dev/null 2>&1

# Fill + send
TB=$(agent-browser snapshot -i 2>&1 | grep -E '^\- textbox' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
echo "textbox: $TB"
agent-browser fill "$TB" "List 3 AI agent patterns as a markdown bullet list, then show a tiny code block" >/dev/null 2>&1
agent-browser wait 200 >/dev/null 2>&1
SEND=$(agent-browser snapshot -i 2>&1 | grep -iE 'button "Send"' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
echo "send: $SEND"
agent-browser click "$SEND" >/dev/null 2>&1

# Monitor stream
echo "streaming..."
for i in 1 2 3 4 5 6 7 8; do
  sleep 3
  len=$(agent-browser eval "document.querySelector('main')?.innerText.length||0" 2>/dev/null | tail -1)
  echo "t=$((i*3))s len=$len"
done

agent-browser screenshot /tmp/final-chat.png >/dev/null 2>&1
echo "=== CHAT CONTENT (first 900 chars) ==="
agent-browser eval "document.querySelector('main')?.innerText.slice(0,900)" 2>&1 | tail -15

echo "=== HISTORY TAB ==="
HTAB=$(agent-browser snapshot -i 2>&1 | grep -iE 'tab "History"' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
echo "history tab: $HTAB"
if [ -n "$HTAB" ]; then
  agent-browser click "$HTAB" >/dev/null 2>&1
  agent-browser wait 800 >/dev/null 2>&1
  agent-browser eval "document.querySelector('main')?.innerText.slice(0,400)" 2>&1 | tail -6
fi

echo "=== ERRORS ==="
agent-browser errors 2>&1 | tail -6
echo "=== DONE ==="
