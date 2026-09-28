export const dynamic = 'force-dynamic';

type UnifiedItem = {
  id: string;
  source: 'anilist' | 'kitsu' | 'aniliberty' | 'tmdb';
  kind: 'anime' | 'movie' | 'tv';
  title: string;
  originalTitle?: string;
  poster: string | null;
  year: number | null;
  rating: number | null;
  format?: string;
  description?: string;
};

const clean = (value: unknown, max = 160) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const image = (value: unknown) => typeof value === 'string' && /^https:\/\//.test(value) ? value : null;

async function anilist(q: string): Promise<UnifiedItem[]> {
  const query = `query ($search:String){Page(page:1,perPage:8){media(type:ANIME,isAdult:false,search:$search,sort:[POPULARITY_DESC]){id title{romaji english} coverImage{large} averageScore seasonYear format description(asHtml:false)}}}`;
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {'Content-Type':'application/json','Accept':'application/json'},
    body: JSON.stringify({query, variables:{search:q}}),
    signal: AbortSignal.timeout(7000),
    next: {revalidate: 300},
  });
  if (!response.ok) return [];
  const json = await response.json();
  return (json.data?.Page?.media || []).map((m: any) => ({
    id: String(m.id), source:'anilist', kind:'anime',
    title: clean(m.title?.english || m.title?.romaji || 'Sem título'),
    originalTitle: clean(m.title?.romaji || ''), poster:image(m.coverImage?.large),
    year:Number.isFinite(m.seasonYear) ? m.seasonYear : null,
    rating:Number.isFinite(m.averageScore) ? Number((m.averageScore/10).toFixed(1)) : null,
    format:clean(m.format || 'Anime'), description:clean(m.description, 500),
  }));
}

async function kitsu(q: string): Promise<UnifiedItem[]> {
  const url = new URL('https://kitsu.io/api/edge/anime');
  url.searchParams.set('page[limit]','8');
  url.searchParams.set('filter[text]',q);
  const response = await fetch(url, {headers:{Accept:'application/vnd.api+json'}, signal:AbortSignal.timeout(7000), next:{revalidate:300}});
  if (!response.ok) return [];
  const json = await response.json();
  return (json.data || []).filter((row:any)=>row.attributes?.ageRating !== 'R18').map((row:any)=>{
    const a=row.attributes||{}; const poster=a.posterImage?.large||a.posterImage?.original;
    return {id:`kitsu:${row.id}`,source:'kitsu',kind:'anime',title:clean(a.canonicalTitle||a.slug||'Sem título'),originalTitle:clean(a.titles?.en||''),poster:image(poster),year:Number(String(a.startDate||'').slice(0,4))||null,rating:Number(a.averageRating)?Number((Number(a.averageRating)/10).toFixed(1)):null,format:clean(a.subtype||'Anime'),description:clean(a.synopsis,500)};
  });
}

async function aniliberty(q: string): Promise<UnifiedItem[]> {
  const url = new URL('https://anilibria.top/api/v1/anime/catalog/releases');
  url.searchParams.set('search', q);
  url.searchParams.set('limit','8');
  const response = await fetch(url, {headers:{Accept:'application/json'}, signal:AbortSignal.timeout(7000), next:{revalidate:300}});
  if (!response.ok) return [];
  const json = await response.json();
  const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json?.list) ? json.list : [];
  return rows.filter((row:any)=>row?.age_rating?.is_adult !== true).map((row:any)=>{
    const name=row.name||row.title||row.release?.name||{};
    const poster=row.poster?.optimized?.preview||row.poster?.preview||row.poster?.thumbnail||row.release?.poster?.preview;
    return {id:`aniliberty:${row.id||row.release?.id}`,source:'aniliberty',kind:'anime',title:clean(typeof name==='string'?name:name.main||name.english||name.alternative||'Sem título'),originalTitle:clean(typeof name==='object'?name.english||name.main:'') ,poster:image(typeof poster==='string'&&poster.startsWith('http')?poster:null),year:Number(row.year||row.release?.year)||null,rating:null,format:clean(row.type?.description||row.release?.type?.description||'Anime'),description:clean(row.description||row.release?.description,500)};
  });
}

async function tmdb(type:'movie'|'tv', q:string): Promise<UnifiedItem[]> {
  const token=process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if(!token) return [];
  const url=new URL(`https://api.themoviedb.org/3/search/${type}`);
  url.searchParams.set('language','pt-BR'); url.searchParams.set('page','1'); url.searchParams.set('query',q); url.searchParams.set('include_adult','false');
  const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(7000),next:{revalidate:300}});
  if(!response.ok) return [];
  const json=await response.json();
  return (json.results||[]).filter((x:any)=>!x.adult).slice(0,8).map((x:any)=>({id:`${type}:${x.id}`,source:'tmdb',kind:type,title:clean(x.title||x.name||'Sem título'),poster:x.poster_path?`https://image.tmdb.org/t/p/w500${x.poster_path}`:null,year:Number(String(x.release_date||x.first_air_date||'').slice(0,4))||null,rating:Number(x.vote_average)?Number(Number(x.vote_average).toFixed(1)):null}));
}

export async function GET(request: Request) {
  const url=new URL(request.url);
  const q=clean(url.searchParams.get('q'),80);
  if(q.length<2) return Response.json({items:[],sources:[],sourceStatus:{}},{headers:{'Cache-Control':'no-store'}});

  const results = await Promise.allSettled([
    anilist(q),
    kitsu(q),
    aniliberty(q),
    tmdb('movie',q),
    tmdb('tv',q),
  ]);
  const sourceNames = ['AniList','Kitsu','AniLiberty/Kitsune','TMDB Filmes','TMDB Séries'];
  const sourceStatus = Object.fromEntries(results.map((result, index) => [
    sourceNames[index], result.status === 'fulfilled' ? 'ok' : 'error',
  ]));
  const groups=results.flatMap(x=>x.status==='fulfilled'?x.value:[]);
  const seen=new Set<string>();
  const items=groups.filter(item=>{
    const key=`${item.kind}:${item.title.toLocaleLowerCase('pt-BR')}`;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).slice(0,30);

  return Response.json(
    {items,sources:Object.keys(sourceStatus).filter(name=>sourceStatus[name]==='ok'),sourceStatus},
    {headers:{'Cache-Control':'public, max-age=30, stale-while-revalidate=120'}}
  );
}
