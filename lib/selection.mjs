import {normalizeConfig} from './config.mjs';
export function validMovie(movie) {
 return Number.isSafeInteger(movie?.id) && movie.id>0 && typeof movie.title==='string' && movie.title.length>0 && Number.isInteger(movie.year) && movie.year>1800 && /^https:\/\/(image|media)\.tmdb\.org\/t\/p\/[^?#]+\.(jpg|png|webp)$/i.test(movie.poster||'') && !movie.genres?.includes(99);
}
export function matchesAdvanced(movie,config) {
 return (!config.people.length || config.people.some(p=>movie.peopleIds?.includes(p.id))) && (!config.country || movie.countries?.includes(config.country)) && (!config.language || movie.language===config.language);
}
export function preferenceTier(movie,config) {
 const decade=!config.decade || (movie.year>=Number(config.decade)&&movie.year<=Number(config.decade)+9);
 const genre=!config.genre || movie.genres?.includes(Number(config.genre));
 return decade&&genre ? 0 : genre ? 1 : 2;
}
function shuffle(items,rng) {
 const list=[...items];
 for(let i=list.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[list[i],list[j]]=[list[j],list[i]]}
 return list;
}
// Recent-title rotation applies only to unfiltered games and adds no discovery requests.
export function rotationPenalty(id,recentIds,config){
 if(config.genre||config.decade||config.country||config.language||config.people?.length||!Array.isArray(recentIds))return 0;
 const ids=recentIds.slice(-180);
 const index=ids.lastIndexOf(id);
 if(index<0)return 0;
 return Math.max(0,1-(ids.length-1-index)/120);
}
// TV has its own editorial relevance policy. Movie scoring stays unchanged without history.
export function selectTvSeries(input,rawConfig,rng=Math.random,recentIds=[]){
 const config=normalizeConfig(rawConfig,'tv');
 const kidsMode=config.genre==='10762';
 const base=[...new Map(input.filter(validMovie).filter(m=>matchesAdvanced(m,config))
  .filter(m=>!config.genre||m.genres?.includes(Number(config.genre)))
  .filter(m=>!config.decade||m.decades?.includes(Number(config.decade)))
  .filter(m=>kidsMode||!m.audience?.kids).map(m=>[m.id,m])).values()];
 const candidates=base.filter(m=>config.difficulty==='expert'||!m.audience?.anime);
 const maxVotes=Math.max(1,...candidates.map(m=>m.votes||1));
 const tier=m=>{
  const decade=!config.decade||m.decades?.includes(Number(config.decade));
  const genre=!config.genre||m.genres?.includes(Number(config.genre));
  return decade&&genre?0:genre?1:2;
 };
 // Keep famous scripted shows dominant in both levels. Expert only broadens
 // recognition somewhat; it does not invert popularity as movie Expert does.
 const scored=candidates.map(m=>{
  const recognition=Math.log1p(m.votes||0)/Math.log1p(maxVotes);
  const quality=Math.max(.1,Math.min(1,(m.score||5)/10));
  const relevance=(config.difficulty==='expert'?.52:.76)*recognition+
    (config.difficulty==='expert'?.48:.24)*quality;
  return {m,t:tier(m),key:relevance+(rng()-.5)*(config.difficulty==='expert'?.35:.18)-rotationPenalty(m.id,recentIds,config)*.27};
 }).sort((a,b)=>a.t-b.t||b.key-a.key);
 const ordered=scored.filter(x=>!x.m.audience?.anime).map(x=>x.m);
 const available=Math.max(0,ordered.length-1);
 if(available<5)return {status:'empty',available,config,message:'No encontramos suficientes series con esos filtros.'};
 if(available<config.duels)return {status:'insufficient',available:Math.min(40,available),config,message:'Podés jugar una partida más corta o modificar los filtros.'};
 let selected=[];
 const animationLimit=(config.genre==='16'||kidsMode)?Infinity:Math.max(1,Math.round((config.duels+1)*.25));
 let animatedCount=0;
 for(const m of ordered){
  if(m.genres?.includes(16)){
   if(animatedCount>=animationLimit)continue;
   animatedCount++;
  }
  selected.push(m);
  if(selected.length===config.duels+1)break;
 }
 if(selected.length<config.duels+1){
  return {status:'insufficient',available:Math.max(0,selected.length-1),config,message:'Podés jugar una partida más corta o modificar los filtros.'};
 }
 // Expert: anime is occasional (at most one in a long match), never a
 // substitute for recognizable live-action or adult-animation favorites.
 if(config.difficulty==='expert'&&!kidsMode&&rng()<.25){
  const anime=scored.filter(x=>x.m.audience?.anime&&x.t===0).sort((a,b)=>b.key-a.key)[0]?.m;
  if(anime&&!selected.some(m=>m.id===anime.id)){
   const replace=selected.findLastIndex(m=>!m.audience?.anime);
   if(replace>=0)selected[replace]=anime;
  }
 }
 const deck=shuffle(selected,rng);
 return {status:'ready',config,deck,reserves:ordered.filter(m=>!selected.some(s=>s.id===m.id)).slice(0,12)};
}
export function selectMovies(input,rawConfig,rng=Math.random,mode='movie',recentIds=[]) {
 if(mode==='tv')return selectTvSeries(input,rawConfig,rng,recentIds);
 const config=normalizeConfig(rawConfig,mode);
 const candidates=[...new Map(input.filter(validMovie).filter(m=>matchesAdvanced(m,config)).map(m=>[m.id,m])).values()];
 // Quality and recognition are independent. Expert favors less familiar, well-regarded titles.
 const maxVotes=Math.max(1,...candidates.map(m=>m.votes||1));
 const weighted=candidates.map(movie=>{
  const recognition=Math.log1p(movie.votes||0)/Math.log1p(maxVotes);
  const quality=Math.max(.1,Math.min(1,(movie.score||5)/10));
  const weight=config.difficulty==='expert' ? .12+quality*(1.15-recognition)**2 : .12+quality*recognition**2;
  return {movie,key:-Math.log(Math.max(.00001,rng()))/(weight*(1-.82*rotationPenalty(movie.id,recentIds,config)))};
 });
 weighted.sort((a,b)=>preferenceTier(a.movie,config)-preferenceTier(b.movie,config) ||
  // Prefer years near the original decade when broadening it.
  (config.decade && preferenceTier(a.movie,config)>0 ? Math.floor(Math.abs(a.movie.year-(+config.decade+4))/20)-Math.floor(Math.abs(b.movie.year-(+config.decade+4))/20) : 0) || a.key-b.key);
 let ordered=weighted.map(x=>x.movie);
 // Within each preference tier, give each selected filmography a turn when possible.
 if(config.people.length>1) {
  ordered=[];
  for(const tier of [0,1,2]) {
   const remaining=weighted.filter(x=>preferenceTier(x.movie,config)===tier).map(x=>x.movie);
   let turn=0;
   while(remaining.length) {
    const person=config.people[turn++%config.people.length];
    const index=remaining.findIndex(m=>m.peopleIds?.includes(person.id));
    ordered.push(...remaining.splice(index<0?0:index,1));
   }
  }
 }
 const available=Math.max(0,candidates.length-1);
 if(available<5) return {status:'empty',available,config,message:'No encontramos suficientes películas con afiche. Modificá los filtros para empezar.'};
 if(available<config.duels) return {status:'insufficient',available:Math.min(40,available),config,message:'Podés jugar una partida más corta o modificar los filtros.'};
 const selected=ordered.slice(0,config.duels+1);
 // Shuffle the chosen set: famous titles can appear at any point, with a balanced opening.
 const deck=shuffle(selected,rng);
 // Avoid an extreme recognition gap in the opening when an alternative is available.
 const opening=deck[0];
 const nearest=deck.slice(1,Math.min(8,deck.length)).map((m,i)=>({i:i+1,d:Math.abs(Math.log1p(m.votes||0)-Math.log1p(opening.votes||0))})).sort((a,b)=>a.d-b.d)[0];
 if(nearest) [deck[1],deck[nearest.i]]=[deck[nearest.i],deck[1]];
 return {status:'ready',config,deck,reserves:ordered.slice(config.duels+1,config.duels+13)};
}
