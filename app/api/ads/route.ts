import { redis } from '../../../lib/admin';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {return Response.json({enabled:(await redis(['GET','ampp:ads']))==='1', configured:false},{headers:{'Cache-Control':'no-store'}});}
  catch {return Response.json({enabled:false,configured:false,error:'Configuração indisponível'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
