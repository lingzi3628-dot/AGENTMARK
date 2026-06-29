#!/bin/bash
# Verify all new features: nav, publish, integrations, new nodes, embed.
set +e
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
sleep 1
# Clear old templates so the new ones seed fresh
rm -f dev.log
# Reset templates table so new DEFAULT_TEMPLATES seed (idempotent — only seeds if empty)
setsid bash -c 'exec ./node_modules/.bin/next dev -p 3000 > dev.log 2>&1' </dev/null >/dev/null 2>&1 &
disown
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && { echo "server up ${i}s"; break; }
  sleep 1
done

agent-browser open http://localhost:3000/ >/dev/null 2>&1
agent-browser wait --load networkidle >/dev/null 2>&1
agent-browser eval "localStorage.setItem('giselle.onboarded','1')" >/dev/null 2>&1

echo "=== SIDEBAR NAV ITEMS ==="
agent-browser snapshot -i 2>&1 | grep -E '^\- button "(Dashboard|Studio|Run|Templates|Knowledge|Publish|Integrations)"' | head -8

echo "=== GO TO PUBLISH ==="
agent-browser find role button click --name "Publish" >/dev/null 2>&1
agent-browser wait 1500 >/dev/null 2>&1
echo "publish view: $(agent-browser eval 'document.querySelector("h1")?.innerText' 2>/dev/null | tail -1)"

echo "=== GO TO INTEGRATIONS ==="
agent-browser find role button click --name "Integrations" >/dev/null 2>&1
agent-browser wait 1500 >/dev/null 2>&1
echo "integrations view: $(agent-browser eval 'document.querySelector("h1")?.innerText' 2>/dev/null | tail -1)"
agent-browser eval "document.querySelector('main')?.innerText.slice(0,200)" 2>&1 | tail -3
agent-browser screenshot /tmp/integrations.png >/dev/null 2>&1

echo "=== GO TO STUDIO (check new nodes in palette) ==="
agent-browser find role button click --name "Studio" >/dev/null 2>&1
agent-browser wait 2500 >/dev/null 2>&1
echo "palette draggable items: $(agent-browser eval 'document.querySelectorAll("[draggable=true]").length' 2>/dev/null | tail -1)"
agent-browser eval "Array.from(document.querySelectorAll('[draggable=true]')).map(e=>e.textContent.replace(/\\s+/g,' ').trim().slice(0,30)).join(' | ')" 2>&1 | tail -2

echo "=== GO TO TEMPLATES (new templates?) ==="
agent-browser find role button click --name "Templates" >/dev/null 2>&1
agent-browser wait 2000 >/dev/null 2>&1
agent-browser eval "document.querySelector('main')?.innerText.match(/(Smart Triage Router|Memory Assistant|API-Powered Analyst|Voice Narrator)/g)?.join(', ')" 2>&1 | tail -2

echo "=== PUBLISH AN AGENT + TEST EMBED ==="
agent-browser find role button click --name "Dashboard" >/dev/null 2>&1
agent-browser wait 1000 >/dev/null 2>&1
agent-browser find role button click --name "Publish" >/dev/null 2>&1
agent-browser wait 1500 >/dev/null 2>&1
# Pick first agent if picker shows
PICK=$(agent-browser snapshot -i 2>&1 | grep -E 'nodes"' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
if [ -n "$PICK" ]; then
  agent-browser click "$PICK" >/dev/null 2>&1
  agent-browser wait 1500 >/dev/null 2>&1
fi
# Toggle publish switch
SW=$(agent-browser snapshot -i 2>&1 | grep -iE 'switch|Publish this agent' | sed -E 's/.*\[ref=(e[0-9]+)\].*/@\1/' | head -1)
echo "publish switch: $SW"
agent-browser snapshot -i 2>&1 | grep -iE "publish|embed|script|iframe" | head -5
agent-browser screenshot /tmp/publish.png >/dev/null 2>&1

echo "=== TEST EMBED PAGE (direct) ==="
SLUG=$(curl -s http://localhost:3000/api/agents 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
echo "first agent id: $SLUG"

echo "=== ERRORS ==="
agent-browser errors 2>&1 | tail -8
echo "=== DEV LOG ERRORS ==="
grep -iE "error|fail|⨯" dev.log 2>/dev/null | grep -v "prisma:query" | tail -8
echo "=== DONE ==="
