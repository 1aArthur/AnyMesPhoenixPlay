export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const search = (requestUrl.searchParams.get('q') || '').trim().slice(0, 80);
  const page = Math.min(30, Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10) || 1));
  const genre = (requestUrl.searchParams.get('genre') || '').trim();
  const allowedGenres: Record<string,string> = { Action: 'action', Adventure: 'adventure', Fantasy: 'fantasy', Comedy: 'comedy', 'Slice of Life': 'slice-of-life', 'Sci-Fi': 'science-fiction' };
  const url = new URL('https://kitsu.io/api/edge/anime');
  url.searchParams.set('page[limit]', '18');
  url.searchParams.set('page[offset]', String((page - 1) * 18));
  if (search) url.searchParams.set('filter[text]', search);
  if (Object.hasOwn(allowedGenres, genre)) url.searchParams.set('filter[categories]', allowedGenres[genre]);
  if (!search && !genre) url.searchParams.set('sort', requestUrl.searchParams.get('sort') === 'SCORE_DESC' ? '-averageRating' : '-userCount');
  try {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return Response.json({ error: 'Kitsu indisponível' }, { status: 502 });
    const json = await response.json() as { data?: Array<{ id: string, attributes?: Record<string, unknown> }>, links?: {next?: string} };
    const items = (json.data || []).filter(row => row.attributes?.ageRating !== 'R18').map(row => {
      const a = row.attributes || {};
      const image = a.posterImage as {large?: string, original?: string} | null;
      const year = String(a.startDate || '').slice(0,4);
      return {id: `kitsu:${row.id}`, source:'kitsu', title:{english: String(a.canonicalTitle || a.slug || 'Anime')}, coverImage:{large:image?.large || image?.original || ''}, averageScore:Number(a.averageRating || 0), seasonYear: Number(year)||null, episodes: Number(a.episodeCount)||null, format:String(a.subtype || 'Anime'), description:String(a.synopsis || '').slice(0,1200), slug:String(a.slug || '')};
    });
    return Response.json({items, hasMore: Boolean(json.links?.next)}, {headers:{'Cache-Control':'public, max-age=30, stale-while-revalidate=120'}});
  } catch { return Response.json({error:'Kitsu indisponível'}, {status:502}); }
}
