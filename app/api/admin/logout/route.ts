import { NextRequest, NextResponse } from 'next/server';
import { isOwner, ownerCookie, sameOrigin } from '../../../../lib/admin';

export async function POST(request: NextRequest) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!isOwner(request) || !sameOrigin(request)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403, headers });
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set({ ...ownerCookie(''), maxAge: 0 });
  return response;
}
