export const privateHeaders = { 'Cache-Control': 'no-store' };

export class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Bound actual bytes, even when Content-Length is absent or incorrect.
export async function readSmallJson(request: Request, limit = 1024): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError('Envie JSON com Content-Type application/json', 415);
  }
  if (Number(request.headers.get('content-length')) > limit) {
    throw new RequestError('Requisição muito grande', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('JSON inválido', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new RequestError('Requisição muito grande', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new RequestError('JSON inválido', 400);
  }
}
