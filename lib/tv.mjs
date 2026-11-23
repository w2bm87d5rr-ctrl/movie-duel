import {tmdb} from './tmdb.mjs';
import {TV_GENRES,localizedOptions,normalizeConfig,configIssue} from './config.mjs';
import {selectMovies,validMovie} from './selection.mjs';
const EXCLUDED=new Set([99,10763,10764,10766,10767]);
export function normalizeSeries(m,personIds=[]){
 return {id:m.id,title:m.name||m.original_name||'',originalTitle:m.original_name||'',year:Number((m.first_air_date||'').slice(0,4)),poster:m.poster_path?'https://image.tmdb.org/t/p/w500'+m.poster_path:'',genres:m.genre_ids||m.genres?.map(g=>g.id)||[],countries:[...new Set([...(m.origin_country||[]),...(m.production_countries||[]).map(c=>c.iso_3166_1)])],language:m.original_language,score:m.vote_average||0,votes:m.vote_count||0,popularity:m.popularity||0,peopleIds,type:m.type};
}
export async function getTvOptions(){
 const [countries,languages,genres]=await Promise.all([tmdb('configuration/countries'),tmdb('configuration/languages'),tmdb('genre/tv/list')]);
 if(!Array.isArray(countries)||!countries.length||!Array.isArray(languages)||!languages.length||!genres.genres?.length)throw Error('TMDB devolvió metadatos incompletos.');
 return {countries:localizedOptions(countries.map(c=>c.iso_3166_1),'region'),languages:localizedOptions(languages.map(l=>l.iso_639_1),'language'),genres:TV_GENRES.map(g=>({id:g.id,name:genres.genres.find(t=>String(t.id)===g.id)?.name||g.name})),source:'tmdb'};
}
async function detailSeries(items,signal){
 const out=[];let cursor=0;
 await Promise.all(Array.from({length:Math.min(5,items.length)},async()=>{
  while(cursor<items.length){
   signal.throwIfAborted();const m=items[cursor++];
   try{const detail=normalizeSeries(await tmdb('tv/'+m.id,{},fetch,signal),m.peopleIds);
    if(validMovie(detail)&&!detail.genres.some(g=>EXCLUDED.has(g))&&['Scripted','Miniseries'].includes(detail.type))out.push(detail);
   }catch(e){if(signal.aborted)throw e;}
  }
 }));
 return out;
}
async function candidates(config,signal){
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
  return {movies:await detailSeries(pool,signal),complete:true};
 }
 const pool=new Map();let complete=true;
 for(const tier of [0,1,2]){
  if(tier===1&&!config.decade||tier===2&&!config.genre)continue;
  const args={include_adult:false,without_genres:'99,10763,10764,10766,10767',with_genres:tier<2?config.genre:'',with_original_language:config.language,sort_by:config.difficulty==='expert'?'vote_average.desc':'popularity.desc','vote_count.gte':config.difficulty==='expert'?25:60,'vote_average.gte':6,'first_air_date.lte':new Date().toISOString().slice(0,10)};
  if(tier===0&&config.decade){args['first_air_date.gte']=config.decade+'-01-01';args['first_air_date.lte']=(Number(config.decade)+9)+'-12-31';}
  for(let page=1;page<=4;page++){
   signal.throwIfAborted();
   const data=await tmdb('discover/tv',{...args,page},fetch,signal);
   const batch=(data.results||[]).map(m=>normalizeSeries(m)).filter(validMovie).filter(m=>!pool.has(m.id));
   const verified=await detailSeries(batch,signal);
   for(const m of verified)pool.set(m.id,m);
   if(page>=data.total_pages)break;
   if(page===4)complete=false;
  }
  const eligible=[...pool.values()].filter(m=>(!config.country||m.countries.includes(config.country))&&(!config.language||m.language===config.language));
  if(eligible.length>=config.duels+13)break;
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
 }catch{
  return {status:'error',code:controller.signal.aborted?'TMDB_SEARCH_TIMEOUT':'TMDB_UPSTREAM_ERROR',message:controller.signal.aborted?'La búsqueda de series tardó demasiado. Tus filtros se conservaron. Volvé a intentar.':'No pudimos consultar las series de TMDB. Volvé a intentar en un momento.'};
 }finally{clearTimeout(timer)}
}
