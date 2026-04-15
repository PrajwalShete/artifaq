import { errors, slotIdSchema } from '@artifaq/shared';
import { Hono } from 'hono';
import { getArtifactMeta } from '../lib/storage.js';
import type { AppEnv } from '../types.js';

const app = new Hono<AppEnv>();

app.get('/:id', async (c) => {
  const parsed = slotIdSchema.safeParse(c.req.param('id'));
  if (!parsed.success) {
    throw errors.notFound('Artifact');
  }
  const slotId = parsed.data;

  const meta = await getArtifactMeta({ bucket: c.env.ARTIFACTS }, slotId);
  if (!meta) {
    throw errors.notFound('Artifact');
  }

  const host = c.env.ARTIFACT_HOST;
  const base = host.startsWith('http') ? host : `https://${host}`;
  const rawSrc = `${base}/raw/${slotId}`;
  const updatedAt = meta.updatedAt;
  const filename = meta.filename;

  const html = renderViewer({ filename, rawSrc, updatedAt });

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30, s-maxage=60',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

function renderViewer(p: { filename: string; rawSrc: string; updatedAt: string }): string {
  const safeFilename = escapeHtml(p.filename);
  const safeSrc = escapeAttr(p.rawSrc);
  const safeUpdated = escapeHtml(p.updatedAt);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex">
<title>${safeFilename}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: #0e0f12; color: #e7e9ee; font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
  header.bar {
    display: flex; align-items: center; gap: 14px;
    padding: 10px 16px; border-bottom: 1px solid #262a33; background: #16181d;
    font-size: 13px;
  }
  header.bar .name { font-family: ui-monospace, Menlo, monospace; color: #e7e9ee; }
  header.bar .meta { color: #6b7280; font-family: ui-monospace, Menlo, monospace; font-size: 11px; }
  header.bar .spacer { flex: 1; }
  header.bar button {
    background: transparent; color: #a8adb8; border: 1px solid #262a33;
    padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;
    font-family: inherit;
  }
  header.bar button:hover { color: #e7e9ee; border-color: #3a4050; }
  header.bar a { color: inherit; text-decoration: none; }
  main { height: calc(100% - 41px); }
  iframe { width: 100%; height: 100%; border: 0; background: #fff; }
  .copied { color: #7ee0c8 !important; border-color: #2a4a42 !important; }
</style>
</head>
<body>
<header class="bar" role="banner">
  <span class="name">${safeFilename}</span>
  <span class="meta">updated ${safeUpdated}</span>
  <span class="spacer"></span>
  <button id="copy-btn" type="button" aria-label="Copy link">copy link</button>
  <a href="${safeSrc}" target="_blank" rel="noopener noreferrer"><button type="button">view source</button></a>
</header>
<main>
  <iframe
    src="${safeSrc}"
    sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
    referrerpolicy="no-referrer"
    title="${safeFilename}"
    loading="eager"
  ></iframe>
</main>
<script>
(function(){
  var btn = document.getElementById('copy-btn');
  if (!btn) return;
  btn.addEventListener('click', async function() {
    try {
      await navigator.clipboard.writeText(location.href);
      var t = btn.textContent;
      btn.textContent = 'copied';
      btn.classList.add('copied');
      setTimeout(function(){ btn.textContent = t; btn.classList.remove('copied'); }, 1500);
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

export default app;
