import catalog from './catalog.json' with {type:'json'};
import people from './people.json' with {type:'json'};
import {localizedOptions,normalizeConfig} from './config.mjs';
import {matchesAdvanced,selectMovies} from './selection.mjs';
export const localCatalog=catalog;
export const localPeople=people;
const TTL=86400000;
const cache=new Map();
export function hasToken(){return Boolean(process.env.TMDB_READ_ACCESS_TOKEN)}
export async function tmdb(path,params={},fetcher=fetch) {
 const url=new URL(`https://api.themoviedb.org/3/${path}`);
 for(const [key,value] of Object.entries({language:'es-AR',...params})) if(value!==''&&value!==undefined) url.searchParams.set(key,value);
 const key=url.toString();
 const found=cache.get(key);
 if(found?.expires>Date.now()) return found.value;
 if(!hasToken()) throw Error('TMDB no está configurado.');
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetcher(key,{headers:{Authorization:`Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`},signal:AbortSignal.timeout(8000)});
  if(response.status===429&&attempt===0){await new Promise(r=>setTimeout(r,Math.min(1000,Number(response.headers.get('retry-after')||1)*1000)));continue;}
  if(!response.ok) throw Error('No se pudo consultar TMDB.');
  const value=await response.json();
  if(cache.size>=160) cache.delete(cache.keys().next().value);
  cache.set(key,{expires:Date.now()+TTL,value});return value;
 }
 throw Error('TMDB está ocupado.');
}
function normalizeMovie(m,personIds=[]) {
 return {id:m.id,title:m.title||m.original_title||'',year:Number((m.release_date||'').slice(0,4)),poster:m.poster_path?`https://image.tmdb.org/t/p/w500${m.poster_path}`:'',genres:m.genre_ids||m.genres?.map(g=>g.id)||[],countries:[...new Set([...(m.origin_country||[]),...(m.production_countries||[]).map(c=>c.iso_3166_1)])],language:m.original_language,score:m.vote_average||0,votes:m.vote_count||0,popularity:m.popularity||0,peopleIds:personIds};
}
export async function getOptions(){
 let countries=localizedOptions(catalog.flatMap(m=>m.countries),'region');
 let languages=localizedOptions(catalog.map(m=>m.language),'language');
 if(hasToken()) {
  try {
   const [c,l]=await Promise.all([tmdb('configuration/countries'),tmdb('configuration/languages')]);
   countries=localizedOptions(c.map(x=>x.iso_3166_1),'region');languages=localizedOptions(l.map(x=>x.iso_639_1),'language');
  }catch { /* Cached catalog options remain usable during a temporary outage. */ }
 }
 return {countries,languages,source:hasToken()?'tmdb':'catalog',catalogSize:catalog.length};
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
async function remoteCandidates(config) {
 if(config.people.length) {
  const lists=await Promise.all(config.people.map(async person=>{
   const credits=await tmdb(`person/${person.id}/movie_credits`);
   return [...(credits.cast||[]),...(credits.crew||[]).filter(m=>m.job==='Director')].map(m=>normalizeMovie(m,[person.id]));
  }));
  const union=new Map();
  for(const m of lists.flat()){
   const existing=union.get(m.id);
   union.set(m.id,existing?{...existing,peopleIds:[...new Set([...existing.peopleIds,...m.peopleIds])]}:m);
  }
  let pool=[...union.values()].filter(m=>m.poster&&m.year>1800&&(!config.language||m.language===config.language));
  // Credits omit production countries. Resolve them before applying a country filter.
  if(config.country){
   if(pool.length>100) throw Error('Hay demasiadas películas para verificar el país. Acotá también por idioma o elegí menos personas.');
   const enriched=[];
   for(let i=0;i<pool.length;i+=5) enriched.push(...await Promise.all(pool.slice(i,i+5).map(async m=>normalizeMovie(await tmdb(`movie/${m.id}`),m.peopleIds))));
   pool=enriched;
  }
  return pool;
 }
 const pool=new Map();
 // At most 12 discovery pages (240 candidates). Broaden decade before genre.
 for(const tier of [0,1,2]) {
  if(tier===1&&!config.decade || tier===2&&!config.genre) continue;
  const args={include_adult:false,without_genres:'99',with_genres:tier<2?config.genre:'',with_origin_country:config.country,with_original_language:config.language,sort_by:config.difficulty==='expert'?'vote_average.desc':'popularity.desc','vote_count.gte':config.difficulty==='expert'?40:150,'vote_average.gte':6,'primary_release_date.lte':new Date().toISOString().slice(0,10)};
  if(tier===0&&config.decade){args['primary_release_date.gte']=`${config.decade}-01-01`;args['primary_release_date.lte']=`${Number(config.decade)+9}-12-31`;}
  for(let page=1;page<=4;page++){
   const data=await tmdb('discover/movie',{...args,page});
   for(const movie of data.results||[]) {const m=normalizeMovie(movie);pool.set(m.id,m);}
   if(page>=data.total_pages) break;
  }
  if([...pool.values()].filter(m=>matchesAdvanced(m,config)&&m.poster).length>=config.duels+13) break;
 }
 return [...pool.values()];
}
export async function prepareMatch(input){
 const config=normalizeConfig(input);
 if(!hasToken()) return {...selectMovies(catalog,config),source:'catalog'};
 try{return {...selectMovies(await remoteCandidates(config),config),source:'tmdb'};}
 catch { // Do not silently present a partial local filmography as complete TMDB results.
  return {status:'error',message:'No pudimos completar la consulta a TMDB. Tu partida y tus filtros están guardados. Volvé a intentar en un momento.'};
 }
}
