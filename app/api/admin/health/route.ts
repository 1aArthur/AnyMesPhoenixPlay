import { NextRequest } from 'next/server';
import { isOwner, redis } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isOwner(request)) return Response.json({ error: 'Acesso reservado ao proprietário' }, { status: 403, headers });
  const started = performance.now();
  try {
    if (await redis(['PING']) !== 'PONG') throw new Error();
    return Response.json({ ok: true, storage: 'operacional', latencyMs: Math.round(performance.now() - started) }, { headers });
  } catch {
    return Response.json({ ok: false, storage: 'indisponível', latencyMs: Math.round(performance.now() - started) }, { status: 503, headers });
  }
}
