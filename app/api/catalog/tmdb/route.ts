export const dynamic = 'force-dynamic';

const base = 'https://api.themoviedb.org/3';
type MediaType = 'movie' | 'tv';
const kind = (value: string | null): MediaType => value === 'tv' ? 'tv' : 'movie';
const token = () => process.env.TMDB_READ_ACCESS_TOKEN?.trim();

async function tmdb(path: string, params: Record<string, string> = {}) {
  const url = new URL(base + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(7000), next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error('TMDB indisponível');
  return response.json();
}

export async function GET(request: Request) {
  if (!token()) return Response.json({ error: 'Catálogo de filmes e séries aguardando a configuração TMDB_READ_ACCESS_TOKEN.' }, { status: 503 });
  const url = new URL(request.url);
  const type = kind(url.searchParams.get('type'));
  const id = url.searchParams.get('id');
  const query = (url.searchParams.get('q') || '').trim().slice(0, 80);
  const page = Math.min(20, Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
  try {
    if (id !== null) {
      if (!/^[1-9]\d{0,9}$/.test(id)) return Response.json({ error: 'ID inválido' }, { status: 400 });
      const data = await tmdb(`/${type}/${id}`, { language: 'pt-BR', append_to_response: 'videos,watch/providers,external_ids' });
      const videos = Array.isArray(data.videos?.results) ? data.videos.results : [];
      const results = data['watch/providers']?.results?.BR;
      return Response.json({ id: data.id, type, title: data.title || data.name, overview: data.overview || '', year: String(data.release_date || data.first_air_date || '').slice(0, 4), poster: /^\/[\w/.-]+$/.test(data.poster_path || '') ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null, imdbId: /^tt\d{7,10}$/.test(data.external_ids?.imdb_id || '') ? data.external_ids.imdb_id : null, tmdbUrl: `https://www.themoviedb.org/${type}/${id}`, providerUrl: results?.link?.startsWith('https://') ? results.link : null, providers: Array.isArray(results?.flatrate) ? results.flatrate.slice(0, 8).map((p: { provider_name: string }) => p.provider_name) : [], trailers: videos.filter((v: { site?: string, key?: string, type?: string }) => v.site === 'YouTube' && /^(Trailer|Teaser|Clip)$/.test(v.type || '') && /^[A-Za-z0-9_-]{11}$/.test(v.key || '')).slice(0, 8).map((v: { name: string, key: string }) => ({ title: v.name, url: `https://www.youtube.com/watch?v=${v.key}` })) }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
    }
    const data = await tmdb(query ? `/search/${type}` : `/${type}/popular`, { language: 'pt-BR', page: String(page), include_adult: 'false', ...(query ? { query } : {}) });
    return Response.json({ items: (data.results || []).filter((item: { adult?: boolean }) => !item.adult).map((item: { id: number, title?: string, name?: string, poster_path?: string, vote_average?: number, release_date?: string, first_air_date?: string }) => ({ id: item.id, type, title: item.title || item.name || 'Sem título', poster: /^\/[\w/.-]+$/.test(item.poster_path || '') ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null, rating: Number(item.vote_average || 0), year: String(item.release_date || item.first_air_date || '').slice(0, 4) })), hasMore: page < Math.min(20, data.total_pages || 0) }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch { return Response.json({ error: 'O catálogo TMDB está indisponível agora.' }, { status: 502 }); }
}
