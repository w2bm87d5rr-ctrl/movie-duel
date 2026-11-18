import {setTimeout as wait} from 'node:timers/promises';
import catalog from './catalog.json' with {type:'json'};
import people from './people.json' with {type:'json'};
import {GENRES,localizedOptions,normalizeConfig,configIssue} from './config.mjs';
import {matchesAdvanced,selectMovies,validMovie} from './selection.mjs';
export const localCatalog=catalog;
export const localPeople=people;
const TTL=86400000;
const cache=new Map();
export function hasToken(){return Boolean(process.env.TMDB_READ_ACCESS_TOKEN)}
export async function tmdb(path,params={},fetcher=fetch,signal) {
 signal?.throwIfAborted();
 const url=new URL(`https://api.themoviedb.org/3/${path}`);
 for(const [key,value] of Object.entries({language:'es-AR',...params})) if(value!==''&&value!==undefined) url.searchParams.set(key,value);
 const key=url.toString();
 if(!hasToken()) throw Error('TMDB no está configurado.');
 const found=cache.get(key);
 if(found?.expires>Date.now()) return found.value;
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetcher(key,{headers:{Authorization:`Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`},signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});
  if(response.status===429&&attempt===0){const delay=Number(response.headers.get('retry-after')||1)*1000;
   if(!Number.isFinite(delay)||delay>2000)throw Error('TMDB_RATE_LIMIT');
   await wait(Math.max(0,delay),undefined,{signal});signal?.throwIfAborted();continue;}
  if(!response.ok){const error=new Error('No se pudo consultar TMDB.');error.code=[401,403].includes(response.status)?'TMDB_AUTH_ERROR':response.status===429?'TMDB_RATE_LIMIT':'TMDB_UPSTREAM_ERROR';throw error;}
  const value=await response.json();
  if(cache.size>=160) cache.delete(cache.keys().next().value);
  cache.set(key,{expires:Date.now()+TTL,value});return value;
 }
 throw Error('TMDB está ocupado.');
}
function normalizeMovie(m,personIds=[]) {
 return {id:m.id,title:m.title||m.original_title||'',originalTitle:m.original_title||'',year:Number((m.release_date||'').slice(0,4)),poster:m.poster_path?`https://image.tmdb.org/t/p/w500${m.poster_path}`:'',genres:m.genre_ids||m.genres?.map(g=>g.id)||[],countries:[...new Set([...(m.origin_country||[]),...(m.production_countries||[]).map(c=>c.iso_3166_1)])],language:m.original_language,score:m.vote_average||0,votes:m.vote_count||0,popularity:m.popularity||0,peopleIds:personIds};
}
export async function getOptions(){
 if(!hasToken()) return {
  countries:localizedOptions(catalog.flatMap(m=>m.countries),'region'),
  languages:localizedOptions(catalog.map(m=>m.language),'language'),
  genres:GENRES,source:'catalog',catalogSize:catalog.length,
 };
 // Only advertise the live catalogue after all authenticated metadata queries succeed.
 const [countries,languages,genreData]=await Promise.all([
  tmdb('configuration/countries'),tmdb('configuration/languages'),tmdb('genre/movie/list'),
 ]);
 if(!Array.isArray(countries)||!countries.length||!Array.isArray(languages)||!languages.length||!genreData.genres?.length)throw Error('TMDB devolvió metadatos incompletos.');
 return {
  countries:localizedOptions(countries.map(c=>c.iso_3166_1),'region'),
  languages:localizedOptions(languages.map(l=>l.iso_639_1),'language'),
  genres:genreData.genres.filter(g=>g.id!==99&&GENRES.some(known=>known.id===String(g.id))).map(g=>({id:String(g.id),name:g.name})),
  source:'tmdb',
 };
}
export async function searchPeople(query) {
 if(query.trim().length<2) return [];
 if(hasToken()) {
  const data=await tmdb('search/person',{query:query.trim().slice(0,100),include_adult:false});
  return (data.results||[]).filter(p=>['Acting','Directing'].includes(p.known_for_department)).slice(0,10).map(p=>({id:p.id,name:p.name,department:p.known_for_department==='Directing'?'Dirección':'Interpretación',photo:p.profile_path?`https://image.tmdb.org/t/p/w185${p.profile_path}`:null}));
 }
 const clean=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es');
 return people.filter(p=>clean(p.name).includes(clean(query))).slice(0,10);
}
export const SEARCH_TIMEOUT_MS=20000;
// A single queue bounds detail requests across pages and credits. Deduplication
// happens before dispatch; fulfilled responses reuse tmdb's existing TTL cache.
async function verifyCountries(movies,signal) {
 const unique=[...new Map(movies.map(m=>[m.id,m])).values()];
 const result=new Array(unique.length);
 let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,unique.length)},async()=>{
  while(cursor<unique.length){
   signal.throwIfAborted();
   const index=cursor++;const m=unique[index];
   result[index]=normalizeMovie(await tmdb(`movie/${m.id}`,{},fetch,signal),m.peopleIds);
  }
 }));
 return result;
}
async function remoteCandidates(config,signal) {
 if(config.people.length) {
  const lists=await Promise.all(config.people.map(async person=>{
   const credits=await tmdb(`person/${person.id}/movie_credits`,{},fetch,signal);
   return [...(credits.cast||[]),...(credits.crew||[]).filter(m=>m.job==='Director')].map(m=>normalizeMovie(m,[person.id]));
  }));
  const union=new Map();
  for(const m of lists.flat()){
   const existing=union.get(m.id);
   union.set(m.id,existing?{...existing,peopleIds:[...new Set([...existing.peopleIds,...m.peopleIds])]}:m);
  }
  let pool=[...union.values()].filter(validMovie).filter(m=>!config.language||m.language===config.language);
  // Credits do not provide reliable production countries. Check every candidate;
  // a large filmography is valid, subject only to the request's time budget.
  if(config.country)pool=await verifyCountries(pool,signal);
  return {movies:pool,complete:true};
 }
 const pool=new Map();
 let complete=true;
 // At most 12 discovery pages (240 candidates). Broaden decade before genre.
 for(const tier of [0,1,2]) {
  if(tier===1&&!config.decade || tier===2&&!config.genre) continue;
  const args={include_adult:false,without_genres:'99',with_genres:tier<2?config.genre:'',with_original_language:config.language,sort_by:config.difficulty==='expert'?'vote_average.desc':'popularity.desc','vote_count.gte':config.difficulty==='expert'?40:150,'vote_average.gte':6,'primary_release_date.lte':new Date().toISOString().slice(0,10)};
  if(tier===0&&config.decade){args['primary_release_date.gte']=`${config.decade}-01-01`;args['primary_release_date.lte']=`${Number(config.decade)+9}-12-31`;}
  for(let page=1;page<=4;page++){
   const data=await tmdb('discover/movie',{...args,page},fetch,signal);
   let batch=(data.results||[]).map(m=>normalizeMovie(m)).filter(validMovie)
    .filter(m=>!config.language||m.language===config.language)
    .filter(m=>!pool.has(m.id));
   if(config.country)batch=await verifyCountries(batch,signal);
   for(const movie of batch)pool.set(movie.id,movie);
   if(page>=data.total_pages)break;
   if(page===4)complete=false;
  }
  if([...pool.values()].filter(m=>matchesAdvanced(m,config)&&m.poster).length>=config.duels+13) break;
 }
 return {movies:[...pool.values()],complete};
}
export async function prepareMatch(input,{timeoutMs=SEARCH_TIMEOUT_MS}={}){
 const issue=configIssue(input);
 if(issue)return {status:'invalid',message:issue};
 const config=normalizeConfig(input);
 if(!hasToken()) return {...selectMovies(catalog,config),source:'catalog'};
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const {movies,complete}=await remoteCandidates(config,controller.signal);
  controller.signal.throwIfAborted();
  const selection=selectMovies(movies,config);
  if(!complete&&selection.status!=='ready'){
   return {status:'error',code:'TMDB_SEARCH_INCOMPLETE',message:'No pudimos completar la búsqueda dentro de los resultados explorados. Esto no significa que no existan películas. Tus filtros se conservaron. Podés reintentar o ajustar los filtros.'};
  }
  return {...selection,source:'tmdb'};
 }catch{
  const timedOut=controller.signal.aborted;controller.abort();
  // Do not convert an unfinished verification into an empty/shorter match.
  return {status:'error',code:timedOut?'TMDB_SEARCH_TIMEOUT':'TMDB_UPSTREAM_ERROR',message:timedOut?'La búsqueda tardó demasiado y no pudimos completarla. Tus filtros se conservaron. Volvé a intentar o acotá la selección.':'No pudimos completar la consulta a TMDB. Tu partida y tus filtros están guardados. Volvé a intentar en un momento.'};
 }finally{clearTimeout(timer)}
}
