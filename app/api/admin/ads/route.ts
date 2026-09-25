import { NextRequest } from 'next/server';
import { isOwner, redis, sameOrigin } from '../../../../lib/admin';
import { privateHeaders as headers, readSmallJson, RequestError } from '../../../../lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  if (!isOwner(request)) return Response.json({error:'Acesso reservado ao proprietário'},{status:403,headers});
  try {return Response.json({enabled:(await redis(['GET','ampp:ads']))==='1',configured:false},{headers});}
  catch {return Response.json({error:'Configuração indisponível'},{status:503,headers});}
}
export async function POST(request: NextRequest) {
  if (!isOwner(request)) return Response.json({error:'Acesso reservado ao proprietário'},{status:403,headers});
  if (!sameOrigin(request)) return Response.json({error:'Origem inválida'},{status:403,headers});
  try {
    const data = await readSmallJson(request);
    if (typeof data.enabled !== 'boolean') return Response.json({error:'enabled deve ser booleano'},{status:400,headers});
    if (await redis(['SET','ampp:ads',data.enabled?'1':'0']) !== 'OK') throw new Error();
    return Response.json({enabled:data.enabled,configured:false},{headers});
  } catch (error) {
    if (error instanceof RequestError) return Response.json({error:error.message},{status:error.status,headers});
    return Response.json({error:'Não foi possível salvar'},{status:503,headers});
  }
}
