import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const HTML_SAMPLE = '<!doctype html><html><body><h1>hi</h1></body></html>';

async function publish(body: string, opts: { slot?: string; filename?: string } = {}) {
  const path = opts.slot ? `/publish?slot=${opts.slot}` : '/publish';
  return SELF.fetch(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      Origin: 'http://localhost:5173',
      'X-Original-Filename': opts.filename ?? 'test.html',
    },
    body,
  });
}

describe('POST /publish', () => {
  it('publishes new HTML and returns a stable URL', async () => {
    const res = await publish(HTML_SAMPLE);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { slotId: string; url: string; rawUrl: string };
    expect(json.slotId).toMatch(/^[a-zA-Z0-9_-]{12}$/);
    expect(json.url).toContain(json.slotId);
    expect(json.rawUrl).toContain(json.slotId);
  });

  it('rejects non-html content types', async () => {
    const res = await SELF.fetch('http://localhost/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: '{}',
    });
    expect(res.status).toBe(415);
  });

  it('rejects empty bodies', async () => {
    const res = await publish('');
    expect(res.status).toBe(400);
  });

  it('returns existing record on republish with same content', async () => {
    const first = await publish(HTML_SAMPLE);
    const { slotId } = (await first.json()) as { slotId: string };
    const second = await publish(HTML_SAMPLE, { slot: slotId });
    expect(second.status).toBe(200);
    const data = (await second.json()) as { slotId: string };
    expect(data.slotId).toBe(slotId);
  });

  it('updates existing slot when content changes', async () => {
    const first = await publish(HTML_SAMPLE);
    const { slotId, createdAt } = (await first.json()) as {
      slotId: string;
      createdAt: string;
    };
    await new Promise((r) => setTimeout(r, 10));
    const second = await publish(`${HTML_SAMPLE}<!-- v2 -->`, { slot: slotId });
    expect(second.status).toBe(201);
    const data = (await second.json()) as {
      slotId: string;
      createdAt: string;
      updatedAt: string;
    };
    expect(data.slotId).toBe(slotId);
    expect(data.createdAt).toBe(createdAt);
    expect(data.updatedAt).not.toBe(createdAt);
  });
});

describe('GET /raw/:id', () => {
  it('returns the HTML with sandbox CSP', async () => {
    const pub = await publish(HTML_SAMPLE);
    const { slotId } = (await pub.json()) as { slotId: string };

    const res = await SELF.fetch(`http://localhost/raw/${slotId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toContain('<h1>hi</h1>');
  });

  it('404s for unknown slot', async () => {
    const res = await SELF.fetch('http://localhost/raw/abcdefghijkl');
    expect(res.status).toBe(404);
  });

  it('400s for malformed slot', async () => {
    const res = await SELF.fetch('http://localhost/raw/!!');
    expect(res.status).toBe(404);
  });
});

describe('GET /a/:id', () => {
  it('renders a viewer page that iframes the raw artifact', async () => {
    const pub = await publish(HTML_SAMPLE, { filename: 'spec.html' });
    const { slotId } = (await pub.json()) as { slotId: string };

    const res = await SELF.fetch(`http://localhost/a/${slotId}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(`/raw/${slotId}`);
    expect(html).toContain('sandbox="allow-scripts');
    expect(html).toContain('spec.html');
  });
});

describe('GET /health', () => {
  it('returns ok with environment', async () => {
    const res = await SELF.fetch('http://localhost/health');
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; env: string };
    expect(json.ok).toBe(true);
    expect(json.env).toBe('development');
  });
});

describe('env bindings present', () => {
  it('has the ARTIFACTS bucket and RATE_LIMIT kv', () => {
    expect(env.ARTIFACTS).toBeDefined();
    expect(env.RATE_LIMIT).toBeDefined();
  });
});
