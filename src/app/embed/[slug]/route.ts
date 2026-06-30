import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Standalone embeddable chat widget — served as raw HTML (no app shell/layout)
// so external sites can load it cleanly in an iframe.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pub = await db.publishedAgent.findUnique({ where: { slug } });
  if (!pub || !pub.enabled) {
    return new Response("Agent not published", { status: 404, headers: { "content-type": "text/plain" } });
  }
  const agent = await db.agent.findUnique({ where: { id: pub.agentId } });
  if (!agent) return new Response("Agent missing", { status: 404, headers: { "content-type": "text/plain" } });

  const name = escapeHtml(agent.name);
  const desc = escapeHtml(agent.description || `Hi! I'm ${agent.name}. How can I help you today?`);
  const emoji = emojiFor(agent.icon);
  const slugJson = JSON.stringify(slug);
  const agentJson = JSON.stringify({ name: agent.name, description: agent.description, icon: agent.icon });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} — Chat</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1419;--card:#1a1f26;--border:#2a3138;--fg:#e8eaed;--muted:#9aa0a6;--primary:#34d399;--primary-fg:#0f1419;--radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
body{background:var(--bg);color:var(--fg);height:100vh;display:flex;flex-direction:column;overflow:hidden}
.header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border);background:var(--card)}
.avatar{width:38px;height:38px;border-radius:10px;background:rgba(52,211,153,.15);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.title{font-weight:600;font-size:15px;line-height:1.2}
.sub{font-size:11px;color:var(--muted);margin-top:2px}
.dot{width:8px;height:8px;border-radius:50%;background:#34d399;display:inline-block;margin-right:4px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
.msg{display:flex;gap:8px;max-width:88%}
.msg.user{align-self:flex-end;flex-direction:row-reverse}
.bubble{padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.msg.assistant .bubble{background:var(--card);border:1px solid var(--border)}
.msg.user .bubble{background:var(--primary);color:var(--primary-fg)}
.msg .bubble.empty{color:var(--muted);font-style:italic}
.composer{border-top:1px solid var(--border);padding:12px;display:flex;gap:8px;background:var(--card)}
.composer textarea{flex:1;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--fg);padding:10px 12px;font-size:14px;font-family:inherit;resize:none;outline:none;min-height:42px;max-height:120px}
.composer textarea:focus{border-color:var(--primary)}
.send{width:42px;height:42px;border-radius:10px;border:none;background:var(--primary);color:var(--primary-fg);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px}
.send:disabled{opacity:.4;cursor:not-allowed}
.send.stop{background:#ef4444;color:#fff}
.scrollbar::-webkit-scrollbar{width:6px}
.scrollbar::-webkit-scrollbar-thumb{background:#3a4148;border-radius:3px}
.footer{padding:6px 16px 10px;text-align:center;font-size:10px;color:var(--muted)}
.footer a{color:var(--primary);text-decoration:none}
</style>
</head>
<body>
<div class="header">
  <div class="avatar">${emoji}</div>
  <div style="flex:1;min-width:0">
    <div class="title">${name}</div>
    <div class="sub"><span class="dot"></span>Online · AI Agent</div>
  </div>
</div>
<div class="messages scrollbar" id="messages">
  <div class="msg assistant">
    <div class="avatar" style="width:28px;height:28px;font-size:14px">${emoji}</div>
    <div class="bubble">${desc}</div>
  </div>
</div>
<div class="composer">
  <textarea id="input" placeholder="Message ${name}…" rows="1"></textarea>
  <button class="send" id="send">➤</button>
</div>
<div class="footer">Powered by <a href="" target="_blank" rel="noreferrer">AGENTMARK</a></div>
<script>
(function(){
  var SLUG = ${slugJson};
  var AGENT = ${agentJson};
  var EMOJI = ${JSON.stringify(emoji)};
  var running = false;
  var controller = null;
  var history = [];
  function emojiFor(name){ var map=${JSON.stringify(EMOJI_MAP)}; return map[name]||'✨'; }
  function scrollBottom(){ var m=document.getElementById('messages'); m.scrollTop=m.scrollHeight; }
  function addMsg(role, text, streaming){
    var m=document.getElementById('messages');
    var wrap=document.createElement('div'); wrap.className='msg '+role;
    if(role==='assistant'){
      var av=document.createElement('div'); av.className='avatar'; av.style.width='28px'; av.style.height='28px'; av.style.fontSize='14px'; av.textContent=EMOJI; wrap.appendChild(av);
    }
    var b=document.createElement('div'); b.className='bubble'+(streaming?' empty':''); b.textContent=text||''; wrap.appendChild(b);
    m.appendChild(wrap); scrollBottom(); return b;
  }
  function setBtn(stopping){
    var b=document.getElementById('send'); if(stopping){ b.className='send stop'; b.textContent='■'; } else { b.className='send'; b.textContent='➤'; }
  }
  function send(){
    var ta=document.getElementById('input');
    var text=ta.value.trim(); if(!text||running) return;
    ta.value=''; ta.style.height='auto';
    addMsg('user', text);
    var bubble=addMsg('assistant', '', true);
    running=true; setBtn(true);
    controller=new AbortController();
    fetch('/api/public/run/'+SLUG,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:text,history:history}),signal:controller.signal})
      .then(function(res){
        if(!res.ok||!res.body){ bubble.textContent='Sorry, I could not respond right now.'; bubble.classList.remove('empty'); running=false; setBtn(false); return; }
        var reader=res.body.getReader(); var dec=new TextDecoder(); var buf=''; var full='';
        function pump(){ return reader.read().then(function(r){
          if(r.done){ running=false; setBtn(false); if(full) history.push({role:'user',content:text},{role:'assistant',content:full}); return; }
          buf+=dec.decode(r.value,{stream:true}); var evs=buf.split('\\n\\n'); buf=evs.pop()||'';
          for(var i=0;i<evs.length;i++){ var lines=evs[i].split('\\n'); var type=''; var data='';
            for(var j=0;j<lines.length;j++){ if(lines[j].indexOf('event:')===0) type=lines[j].slice(6).trim(); else if(lines[j].indexOf('data:')===0) data+=lines[j].slice(5).trim(); }
            if(!type||!data) continue;
            try{ var p=JSON.parse(data);
              if(type==='delta'){ if(p.content){ full+=p.content; bubble.textContent=full; bubble.classList.remove('empty'); } }
              else if(type==='error'){ bubble.textContent='Error: '+(p.message||'unknown'); bubble.classList.remove('empty'); }
            }catch(e){}
          }
          return pump();
        }); }
        return pump();
      })
      .catch(function(e){ if(e.name!=='AbortError'){ bubble.textContent='Connection error.'; } else { bubble.textContent=(bubble.textContent||'')+' [stopped]'; } bubble.classList.remove('empty'); running=false; setBtn(false); });
  }
  document.getElementById('input').addEventListener('keydown',function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
  document.getElementById('input').addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'; });
  document.getElementById('send').addEventListener('click', send);
})();
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function emojiFor(name: string): string {
  const map: Record<string, string> = EMOJI_MAP;
  return map[name] ?? "✨";
}

const EMOJI_MAP: Record<string, string> = {
  sparkles: "✨", bot: "🤖", brain: "🧠", code: "💻", "pen-tool": "✍️",
  search: "🔍", "file-text": "📄", languages: "🌐", database: "🗃️",
  rocket: "🚀", lightbulb: "💡", "wand-2": "🪄",
};
