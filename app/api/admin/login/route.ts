import { NextRequest, NextResponse } from 'next/server';
import { loginLimit, newSession, ownerCookie, ready, sameOrigin, validToken } from '../../../../lib/admin';
import { privateHeaders as headers, readSmallJson, RequestError } from '../../../../lib/http';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({error:'Origem inválida'}, {status:403,headers});
  if (!ready()) return NextResponse.json({error:'Painel não configurado'}, {status:503,headers});
  try {
    const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
    const limit = await loginLimit(ip);
    if (!limit.allowed) return NextResponse.json({error:'Muitas tentativas. Aguarde alguns minutos.'},{status:429,headers:{...headers,'Retry-After':String(limit.retryAfter)}});
    const data = await readSmallJson(request);
    if (typeof data.token !== 'string' || !validToken(data.token)) return NextResponse.json({error:'Token inválido'}, {status:401,headers});
    const response = NextResponse.json({ok:true},{headers});
    response.cookies.set(ownerCookie(newSession()));
    return response;
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({error:error.message},{status:error.status,headers});
    return NextResponse.json({error:'Autenticação indisponível'}, {status:503,headers});
  }
}
