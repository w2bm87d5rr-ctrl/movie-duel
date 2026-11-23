import {tmdb} from './tmdb.mjs';
import {TV_GENRES,localizedOptions,normalizeConfig,configIssue} from './config.mjs';
import {selectMovies,validMovie} from './selection.mjs';
const EXCLUDED=new Set([99,10763,10764,10766,10767]);
// TMDB sometimes marks sports programming as Scripted; confirmed exception.
const NON_FICTION_IDS=new Set([67192]); // New Japan Pro Wrestling
// Adult animation can have Family metadata; do not mistake these for Kids.
const ADULT_ANIMATION_IDS=new Set([456,2190,1434,615]);
export function tvAudience(series){
 const genres=series.genres||[];
 const animated=genres.includes(16);
 const anime=animated&&series.language==='ja'&&series.originCountries?.includes('JP');
 const kids=animated&&(genres.includes(10762)||(genres.includes(10751)&&!ADULT_ANIMATION_IDS.has(series.id)));
 return {anime,kids};
}
export function tvDecades(data){
 const first=Number((data.first_air_date||'').slice(0,4));
 const last=Number((data.last_air_date||'').slice(0,4));
 const years=(data.seasons||[]).filter(s=>s.season_number>0&&s.episode_count>0)
  .map(s=>Number((s.air_date||'').slice(0,4))).filter(y=>y>=1900&&y<=2100);
 const end=last>=first&&last<=2100?last:first;
 // Use the real original season dates when available. For incomplete TMDB
 // season metadata, use the original first/last airing span as fallback.
 if(years.length===0&&first>=1900&&end>=first){
  for(let y=first;y<=Math.min(end,first+80);y++)years.push(y);
 }
 const count=new Map();
 for(const y of years){const d=Math.floor(y/10)*10;count.set(d,(count.get(d)||0)+1)}
 return [...count.entries()].filter(([,n])=>n>=1).map(([d])=>d);
}
// Production-country evidence is stronger than TMDB's origin tags, which can
// also describe the origin of a format adapted in another country.
export function seriesCountries(m){
 const production=[...new Set((m.production_countries||[]).map(c=>typeof c==='string'?c:c.iso_3166_1).filter(Boolean))];
 return production.length?production:[...new Set(m.origin_country||[])];
}
export function normalizeSeries(m,personIds=[]){
 return {id:m.id,title:m.name||m.original_name||'',originalTitle:m.original_name||'',year:Number((m.first_air_date||'').slice(0,4)),decades:tvDecades(m),poster:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:'',genres:m.genre_ids||m.genres?.map(g=>g.id)||[],countries:seriesCountries(m),originCountries:m.origin_country||[],productionCountries:(m.production_countries||[]).map(c=>c.iso_3166_1).filter(Boolean),language:m.original_language,score:m.vote_average||0,votes:m.vote_count||0,popularity:m.popularity||0,peopleIds:personIds,type:m.type,audience:tvAudience({id:m.id,genres:m.genre_ids||m.genres?.map(g=>g.id)||[],language:m.original_language,originCountries:m.origin_country||[]})};
}
export async function getTvOptions(){
 const [countries,languages,genres]=await Promise.all([tmdb('configuration/countries'),tmdb('configuration/languages'),tmdb('genre/tv/list')]);
 if(!Array.isArray(countries)||!countries.length||!Array.isArray(languages)||!languages.length||!genres.genres?.length)throw Error('TMDB devolvió metadatos incompletos.');
 return {countries:localizedOptions(countries.map(c=>c.iso_3166_1),'region'),languages:localizedOptions(languages.map(l=>l.iso_639_1),'language'),genres:TV_GENRES.map(g=>({id:g.id,name:genres.genres.find(t=>String(t.id)===g.id)?.name||g.name})),source:'tmdb'};
}
// A verified scripted title is required before it can enter a TV duel.
// Metadata calls are bounded and cached by the shared TMDB client.
export function isFictionSeries(series){
 return validMovie(series)&&!NON_FICTION_IDS.has(series.id)&&!series.genres.some(g=>EXCLUDED.has(Number(g)))&&['Scripted','Miniseries'].includes(series.type);
}
const VERIFIED_CACHE=new Map();
async function detailSeries(items,signal,{country='',needed=Infinity}={}){
 const out=[];let cursor=0;
 await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{
  while(cursor<items.length&&out.length<needed){
   signal.throwIfAborted();const m=items[cursor++];
   try{
    const cached=VERIFIED_CACHE.get(m.id);
    const detail=cached||normalizeSeries(await tmdb('tv/'+m.id,{},fetch,signal),m.peopleIds);
    if(!cached){if(VERIFIED_CACHE.size>=512)VERIFIED_CACHE.delete(VERIFIED_CACHE.keys().next().value);VERIFIED_CACHE.set(m.id,detail)}
    if(isFictionSeries(detail)&&(!country||detail.countries.includes(country)))out.push({...detail,peopleIds:m.peopleIds||[]});
   }catch(e){if(signal.aborted)throw e}
  }
 }));
 return out;
}
export function tvDiscoveryArgs(config,tier=0,relaxed=false){
 const country=config.country||'';
 const args={include_adult:false,without_genres:'99,10763,10764,10766,10767',
  with_genres:tier<2?config.genre:'',with_original_language:config.language,
  sort_by:config.difficulty==='expert'?'vote_average.desc':'popularity.desc',
  'vote_count.gte':country?(relaxed?0:3):(relaxed?10:(config.difficulty==='expert'?25:60)),
  'vote_average.gte':country?0:(relaxed?0:6),
  'first_air_date.lte':new Date().toISOString().slice(0,10)};
 // Never apply an implicit country. This narrows the server-side TMDB query
 // only when the player explicitly selected one.
 if(country)args.with_origin_country=country;
 if(config.decade){
  // Include series that premiered before the decade but continued airing
  // during it; verified season dates determine actual decade membership.
  args['first_air_date.lte']=(Number(config.decade)+9)+'-12-31';
  if(tier===0)args['first_air_date.gte']=(Number(config.decade)-10)+'-01-01';
 }
 return args;
}
async function candidates(config,signal){
 const required=config.duels+1;
 const target=Math.min(config.duels*3+12,100); // Allow room for audience filtering.
 if(config.people.length){
  const credits=await Promise.all(config.people.map(async person=>{
   const data=await tmdb('person/'+person.id+'/tv_credits',{},fetch,signal);
   return (data.cast||[]).map(m=>normalizeSeries(m,[person.id]));
  }));
  const unique=new Map();
  for(const m of credits.flat()){
   const previous=unique.get(m.id);
   unique.set(m.id,previous?{...previous,peopleIds:[...new Set([...previous.peopleIds,...m.peopleIds])]}:m);
  }
  const pool=[...unique.values()].filter(validMovie).filter(m=>!config.language||m.language===config.language);
  const verified=await detailSeries(pool,signal,{country:config.country});
  return {movies:verified,complete:true};
 }
 const pool=new Map();let complete=true;
 const stages=[];
 for(const tier of [0,1,2]){
  if(tier===1&&!config.decade||tier===2&&!config.genre)continue;
  stages.push({tier,relaxed:false});
 }
 // For smaller catalogues, broaden popularity thresholds without broadening
 // user-selected country, language or genre/decade preferences.
 if(config.country||config.decade)stages.push({tier:0,relaxed:true});
 for(const {tier,relaxed} of stages){
  const args=tvDiscoveryArgs(config,tier,relaxed);
  for(let page=1;page<=4;page++){
   signal.throwIfAborted();
   const data=await tmdb('discover/tv',{...args,page},fetch,signal);
   const batch=(data.results||[]).map(m=>normalizeSeries(m))
    .filter(validMovie).filter(m=>!pool.has(m.id))
    .filter(m=>!config.language||m.language===config.language);
   const verified=await detailSeries(batch,signal,{country:config.country,needed:Math.max(required,pool.size<target?target-pool.size:0)});
   for(const m of verified)pool.set(m.id,m);
   if([...pool.values()].filter(m=> (config.genre==='10762'||!m.audience?.kids) && (config.difficulty==='expert'||!m.audience?.anime) && (!config.decade||m.decades?.includes(Number(config.decade))) && (!config.genre||m.genres.includes(Number(config.genre)))).length>=config.duels+5)break;
   if(page>=data.total_pages)break;
   if(page===4)complete=false;
  }
  if(pool.size>=target)break;
 }
 return {movies:[...pool.values()],complete};
}
export async function prepareTvMatch(input,{timeoutMs=20000}={}){
 const issue=configIssue(input);if(issue)return {status:'invalid',message:issue};
 const config=normalizeConfig(input,'tv');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const {movies,complete}=await candidates(config,controller.signal);
  controller.signal.throwIfAborted();
  const selection=selectMovies(movies,config,Math.random,'tv');
  if(!complete&&selection.status!=='ready')return {status:'error',code:'TMDB_SEARCH_INCOMPLETE',message:'No pudimos completar la búsqueda de series. Tus filtros se conservaron. Podés reintentar o ajustarlos.'};
  if(selection.status==='empty')selection.message='No encontramos suficientes series de ficción con afiche. Modificá los filtros para empezar.';
  return {...selection,source:'tmdb'};
 }catch(error){
  return {status:'error',code:controller.signal.aborted?'TMDB_SEARCH_TIMEOUT':'TMDB_UPSTREAM_ERROR',message:controller.signal.aborted?'La búsqueda de series tardó demasiado. Tus filtros se conservaron. Volvé a intentar.':'No pudimos consultar las series de TMDB. Volvé a intentar en un momento.'};
 }finally{clearTimeout(timer)}
}
