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
export function selectMovies(input,rawConfig,rng=Math.random,mode='movie') {
 const config=normalizeConfig(rawConfig,mode);
 const candidates=[...new Map(input.filter(validMovie).filter(m=>matchesAdvanced(m,config)).map(m=>[m.id,m])).values()];
 // Quality and recognition are independent. Expert favors less familiar, well-regarded titles.
 const maxVotes=Math.max(1,...candidates.map(m=>m.votes||1));
 const weighted=candidates.map(movie=>{
  const recognition=Math.log1p(movie.votes||0)/Math.log1p(maxVotes);
  const quality=Math.max(.1,Math.min(1,(movie.score||5)/10));
  const weight=config.difficulty==='expert' ? .12+quality*(1.15-recognition)**2 : .12+quality*recognition**2;
  return {movie,key:-Math.log(Math.max(.00001,rng()))/weight};
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
