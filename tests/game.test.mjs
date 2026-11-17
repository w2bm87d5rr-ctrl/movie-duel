import test from 'node:test';
import assert from 'node:assert/strict';
import {localCatalog,prepareMatch,searchPeople,getOptions} from '../lib/tmdb.mjs';
import {DEFAULT_CONFIG,normalizeConfig} from '../lib/config.mjs';
import {selectMovies,preferenceTier} from '../lib/selection.mjs';
import {choose,createGame,readSaved,replaceFailedPoster,STORAGE_KEY,undo} from '../lib/game.mjs';
function rng(seed=42){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
const settings={...DEFAULT_CONFIG};
for(const difficulty of ['normal','expert']) for(const duels of [5,10,20,40]) test(`${difficulty}: ${duels} duels, champion, multi-undo and reload`,()=>{
 const selection=selectMovies(localCatalog,{...settings,duels,difficulty},rng());
 assert.equal(selection.status,'ready');assert.equal(selection.deck.length,duels+1);
 assert.equal(new Set([...selection.deck,...selection.reserves].map(m=>m.id)).size,selection.deck.length+selection.reserves.length);
 let game=createGame(selection);const pairs=[];
 for(let i=0;i<duels;i++){
  pairs.push(game.pair);assert.notEqual(game.pair[0].id,game.pair[1].id);
  game=choose(game,game.pair[i%2].id);
 }
 assert.equal(game.history.length,duels);assert.equal(game.pair.length,1);
 const restored=readSaved(JSON.stringify({version:2,config:selection.config,game}));
 assert.deepEqual(restored.game,game);
 assert.equal(choose(game,game.pair[0].id),game);
 for(let i=duels-1;i>=0;i--){game=undo(game);assert.deepEqual(game.pair,pairs[i]);}
 assert.equal(game.history.length,0);assert.equal(undo(game),game);
});
test('configuration is normalized, no documentary, up to five distinct people',()=>{
 assert.deepEqual(normalizeConfig({genre:'99',decade:'1981',duels:99,difficulty:'bad',people:[...Array(8)].map((_,i)=>({id:i+1,name:'Persona'}))}),{...settings,duels:40,people:[...Array(5)].map((_,i)=>({id:i+1,name:'Persona'}))});
 assert.equal(normalizeConfig({duels:1}).duels,5);
});
test('genre, decade, country and original language remain independent',()=>{
 for(const partial of [{genre:'35'},{decade:'1980'},{country:'FR'},{language:'ja'},{genre:'18',decade:'1960',country:'FR',language:'fr'}]){
  const config={...settings,...partial,duels:5};const result=selectMovies(localCatalog,config,rng());
  assert.equal(result.status,'ready');
  assert.ok(result.deck.every(m=>(!config.country||m.countries.includes(config.country))&&(!config.language||m.language===config.language)));
  const strict=localCatalog.filter(m=>preferenceTier(m,config)===0&&(!config.country||m.countries.includes(config.country))&&(!config.language||m.language===config.language));
  if(strict.length>=6)assert.ok(result.deck.every(m=>preferenceTier(m,config)===0));
 }
});
test('several filmographies are OR, types of filters AND, with balanced participants',()=>{
 const config={...settings,duels:5,people:[{id:1243,name:'Woody Allen'},{id:793,name:'Luis Buñuel'}],genre:'35',language:'en'};
 let result=selectMovies(localCatalog,config,rng());assert.equal(result.status,'ready');
 assert.ok(result.deck.every(m=>m.peopleIds.some(id=>[1243,793].includes(id))&&m.language==='en'));
 const movie=(id,person)=>({...localCatalog[0],id,year:1985,genres:[35],peopleIds:[person]});
 const pool=[...Array(20)].map((_,i)=>movie(i+1,i<10?1243:793));
 result=selectMovies(pool,{...settings,duels:10,people:config.people},rng());
 const allen=result.deck.filter(m=>m.peopleIds.includes(1243)).length;
 assert.ok(allen>=5&&allen<=6);
});
test('broadens decade before genre and never relaxes advanced filters',()=>{
 const movie=(id,year,genres,country='FR')=>({...localCatalog[0],id,year,genres,countries:[country],language:'fr',peopleIds:[793]});
 const pool=[movie(1,1985,[35]),...Array.from({length:5},(_,i)=>movie(i+2,1975,[35])),...Array.from({length:6},(_,i)=>movie(i+20,1985,[18])),movie(99,1985,[35],'US')];
 const config={...settings,duels:5,decade:'1980',genre:'35',country:'FR',language:'fr',people:[{id:793,name:'Buñuel'}]};
 const result=selectMovies(pool,config,rng());assert.equal(result.status,'ready');
 assert.ok(result.deck.every(m=>m.genres.includes(35)&&m.countries.includes('FR')&&m.language==='fr'&&m.peopleIds.includes(793)));
 assert.equal(result.deck.filter(m=>m.year===1985).length,1);
 assert.equal(selectMovies(pool,{...config,country:'AR'},rng()).status,'empty');
});
test('insufficient pool offers fewer duels; fewer than six cannot start',()=>{
 const result=selectMovies(localCatalog.slice(0,9),{...settings,duels:40},rng());
 assert.equal(result.status,'insufficient');assert.equal(result.available,8);
 assert.equal(selectMovies(localCatalog.slice(0,5),settings).status,'empty');
});
test('deduplicates and rejects missing/invalid posters and documentaries',()=>{
 const result=selectMovies([...localCatalog,...localCatalog,{...localCatalog[0],id:999,poster:''},{...localCatalog[0],id:998,genres:[99]}],settings,rng());
 assert.equal(result.status,'ready');assert.ok(!result.deck.some(m=>[998,999].includes(m.id)));
});
test('new selections vary and do not systematically place famous films last',()=>{
 const selections=[1,2,3,4,5,6,7,8].map(seed=>selectMovies(localCatalog,settings,rng(seed)).deck);
 assert.ok(new Set(selections.map(m=>m.map(x=>x.id).join(','))).size>1);
 assert.ok(selections.some(deck=>deck[0].votes>deck.at(-1).votes));
 const average=mode=>[1,2,3,4,5,6,7,8].flatMap(seed=>selectMovies(localCatalog,{...settings,difficulty:mode},rng(seed)).deck).reduce((sum,m)=>sum+Math.log1p(m.votes),0);
 assert.ok(average('expert')<average('normal'));
});
test('poster replacements preserve duels and exact undo snapshots',()=>{
 let game=createGame(selectMovies(localCatalog,settings,rng()));
 const initial=game.pair;game=choose(game,initial[0].id);const before=game.history.length;
 const failed=game.pair[1].id;game=replaceFailedPoster(game,failed);
 assert.equal(game.history.length,before);assert.notEqual(game.pair[1].id,failed);
 assert.ok(!game.deck.some(m=>m.id===game.pair[1].id));
 const pair=game.pair;game=choose(game,pair[1].id);game=undo(game);assert.deepEqual(game.pair,pair);
 game=undo(game);assert.deepEqual(game.pair,initial);
});
test('no reserves blocks choices without counting a technical failure',()=>{
 let game=createGame(selectMovies(localCatalog.slice(0,6),{...settings,duels:5},rng()));
 game=replaceFailedPoster(game,game.pair[0].id);
 assert.equal(game.blocked,true);assert.equal(game.history.length,0);
 assert.equal(choose(game,game.pair[1].id),game);
});
test('corrupt saved state is discarded without losing valid preferences',()=>{
 assert.equal(readSaved('broken'),null);assert.equal(readSaved('{"version":1}'),null);
 const restored=readSaved(JSON.stringify({version:2,config:{duels:10},game:{deck:[]}}));
 assert.equal(restored.game,null);assert.equal(restored.config.duels,10);assert.equal(STORAGE_KEY,'movie-duel:v2');
});
test('catalog mode searches people with accents, names localized, 40 duel match',async()=>{
 assert.ok((await searchPeople('bunuel')).some(p=>p.id===793));
 assert.ok((await searchPeople('Woody Allen')).some(p=>p.id===1243));
 assert.deepEqual(await searchPeople('x'),[]);
 const options=await getOptions();assert.equal(options.source,'catalog');
 assert.ok(options.countries.some(c=>c.name==='Francia'));
 assert.ok(options.languages.some(c=>c.name==='español'));
 assert.equal((await prepareMatch({duels:40})).status,'ready');
});
