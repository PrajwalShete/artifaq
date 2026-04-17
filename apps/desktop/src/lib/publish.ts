const API_BASE = import.meta.env.VITE_API_BASE ?? 'https://api.artifaq.io';

export interface PublishInput {
  filename: string;
  body: ArrayBuffer;
  contentHash: string;
  slotId?: string;
}

export interface PublishResponse {
  slotId: string;
  url: string;
  rawUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishError {
  code: string;
  message: string;
  status: number;
}

export async function publishArtifact(input: PublishInput): Promise<PublishResponse> {
  const url = input.slotId
    ? `${API_BASE}/publish?slot=${encodeURIComponent(input.slotId)}`
    : `${API_BASE}/publish`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Original-Filename': input.filename,
      'X-Content-Hash': input.contentHash,
    },
    body: input.body,
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw {
      code: 'invalid_response',
      message: `Server returned non-JSON (HTTP ${res.status})`,
      status: res.status,
    } satisfies PublishError;
  }

  if (!res.ok) {
    const err = json as { error?: string; message?: string };
    throw {
      code: err.error ?? 'unknown',
      message: err.message ?? 'Publish failed',
      status: res.status,
    } satisfies PublishError;
  }
  return json as PublishResponse;
}
