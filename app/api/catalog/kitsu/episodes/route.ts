export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id') || '';
  if (!/^\d{1,12}$/.test(id)) return Response.json({error:'ID inválido'}, {status:400});
  const url = new URL(`https://kitsu.io/api/edge/anime/${id}/episodes`);
  url.searchParams.set('page[limit]', '20');
  url.searchParams.set('page[offset]', '0');
  url.searchParams.set('sort', 'number');
  try {
    const response = await fetch(url, {headers:{Accept:'application/vnd.api+json'},signal:AbortSignal.timeout(6000)});
    if (!response.ok) return Response.json({error:'Episódios indisponíveis'}, {status:502});
    const json = await response.json() as {data?:Array<{attributes?:Record<string, unknown>}>};
    return Response.json({episodes:(json.data||[]).map(item=>({number:Number(item.attributes?.number)||null,title:String(item.attributes?.canonicalTitle||'Episódio'),airDate:String(item.attributes?.airDate||'')}))},{headers:{'Cache-Control':'public, max-age=300'}});
  } catch {return Response.json({error:'Episódios indisponíveis'}, {status:502});}
}
