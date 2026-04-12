export function renderDebugPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Claude Raw Proxy</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f3ea;
        --panel: #fffdf8;
        --ink: #1f2328;
        --muted: #5d655f;
        --line: #d7d1c2;
        --accent: #aa3a2a;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(170, 58, 42, 0.12), transparent 30%),
          linear-gradient(180deg, #fbf8f0 0%, var(--bg) 100%);
      }
      .layout {
        display: grid;
        grid-template-columns: 340px 1fr;
        min-height: 100vh;
      }
      .sidebar,
      .detail {
        padding: 24px;
      }
      .sidebar {
        border-right: 1px solid var(--line);
        background: rgba(255, 253, 248, 0.7);
        backdrop-filter: blur(6px);
      }
      h1, h2, h3 {
        margin: 0 0 12px;
        font-weight: 700;
      }
      .subtle {
        color: var(--muted);
        margin: 0 0 18px;
      }
      .session-list {
        display: grid;
        gap: 10px;
      }
      .session-card {
        border: 1px solid var(--line);
        background: var(--panel);
        border-radius: 14px;
        padding: 14px;
        cursor: pointer;
      }
      .session-card.active {
        border-color: var(--accent);
        box-shadow: 0 0 0 1px rgba(170, 58, 42, 0.18);
      }
      .session-card .line {
        margin: 4px 0;
        font-size: 13px;
        color: var(--muted);
        word-break: break-all;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 18px;
        overflow: hidden;
      }
      .panel-header {
        padding: 14px 16px;
        border-bottom: 1px solid var(--line);
        font-weight: 700;
      }
      .meta {
        padding: 16px;
        display: grid;
        gap: 10px;
      }
      pre {
        margin: 0;
        padding: 16px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: "IBM Plex Mono", Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
      }
      .empty {
        padding: 20vh 24px;
        text-align: center;
        color: var(--muted);
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .sidebar {
          border-right: none;
          border-bottom: 1px solid var(--line);
        }
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="layout">
      <aside class="sidebar">
        <h1>Claude Raw Proxy</h1>
        <p class="subtle">Only two things are shown per session: the raw forwarded request and the raw upstream response.</p>
        <div id="session-list" class="session-list"></div>
      </aside>
      <main class="detail">
        <div id="detail" class="empty">No sessions yet.</div>
      </main>
    </div>
    <script>
      let selectedId = null;

      function renderSessionList(sessions) {
        const root = document.getElementById('session-list');
        root.innerHTML = '';
        if (!sessions.length) {
          root.innerHTML = '<div class="session-card"><div class="line">No sessions</div></div>';
          return;
        }

        if (!selectedId || !sessions.some((session) => session.id === selectedId)) {
          selectedId = sessions[0].id;
        }

        for (const session of sessions) {
          const card = document.createElement('button');
          card.className = 'session-card' + (session.id === selectedId ? ' active' : '');
          card.type = 'button';
          card.innerHTML = [
            '<div><strong>' + session.request.method + '</strong> ' + session.request.url + '</div>',
            '<div class="line">status: ' + (session.response.status ?? 'pending') + '</div>',
            '<div class="line">duration: ' + (session.durationMs ?? '-') + ' ms</div>',
            '<div class="line">time: ' + new Date(session.startedAt).toLocaleTimeString() + '</div>'
          ].join('');
          card.onclick = () => {
            selectedId = session.id;
            renderSessionList(sessions);
            renderDetail(session);
          };
          root.appendChild(card);
        }

        renderDetail(sessions.find((session) => session.id === selectedId));
      }

      function renderDetail(session) {
        const root = document.getElementById('detail');
        if (!session) {
          root.className = 'empty';
          root.textContent = 'No session selected.';
          return;
        }

        const requestText = JSON.stringify({
          method: session.request.method,
          url: session.request.url,
          headers: session.request.headers,
          bodyText: session.request.bodyText,
          chunks: session.request.chunks
        }, null, 2);

        const responseText = JSON.stringify({
          status: session.response.status,
          headers: session.response.headers,
          bodyText: session.response.bodyText,
          chunks: session.response.chunks,
          error: session.response.error
        }, null, 2);

        root.className = '';
        root.innerHTML = [
          '<div class="meta panel"><div class="panel-header">Session Meta</div><div class="meta">',
          '<div><strong>id:</strong> ' + session.id + '</div>',
          '<div><strong>started:</strong> ' + new Date(session.startedAt).toLocaleString() + '</div>',
          '<div><strong>duration:</strong> ' + (session.durationMs ?? '-') + ' ms</div>',
          '</div></div>',
          '<div class="grid" style="margin-top: 18px;">',
          '<section class="panel"><div class="panel-header">Forwarded Request</div><pre></pre></section>',
          '<section class="panel"><div class="panel-header">Upstream Response</div><pre></pre></section>',
          '</div>'
        ].join('');

        const preNodes = root.querySelectorAll('pre');
        preNodes[0].textContent = requestText;
        preNodes[1].textContent = responseText;
      }

      async function refresh() {
        const response = await fetch('/debug/api/sessions');
        const sessions = await response.json();
        renderSessionList(sessions);
      }

      refresh();
      setInterval(refresh, 1000);
    </script>
  </body>
</html>`;
}
