import test from 'node:test';
import assert from 'node:assert/strict';
import {rotationPenalty,selectMovies} from '../lib/selection.mjs';
import {DEFAULT_CONFIG} from '../lib/config.mjs';
const movie=id=>({id,title:'Title '+id,year:2001,poster:'https://image.tmdb.org/t/p/w500/a.jpg',genres:[18],countries:['US'],language:'en',votes:1000,score:8,popularity:100,peopleIds:[]});
test('recent general titles are penalized and recover with age',()=>{
 const c={...DEFAULT_CONFIG};
 const history=Array.from({length:180},(_,i)=>i+1);
 assert.equal(rotationPenalty(180,history,c),1);
 assert.equal(rotationPenalty(1,history,c),0);
 assert.equal(rotationPenalty(999,history,c),0);
 assert.ok(rotationPenalty(150,history,c)<rotationPenalty(180,history,c));
});
test('filters ignore history',()=>{
 const c={...DEFAULT_CONFIG,genre:'18'};
 assert.equal(rotationPenalty(180,[180],c),0);
});
test('general movie selection favors fresh equally recognizable titles',()=>{
 const pool=Array.from({length:90},(_,i)=>movie(i+1));
 const config={...DEFAULT_CONFIG,duels:20};
 const history=Array.from({length:40},(_,i)=>i+1);
 let repeat=0, fresh=0;
 for(let k=0;k<120;k++){
  const a=selectMovies(pool,config,Math.random,'movie',history);
  const b=selectMovies(pool,config,Math.random,'movie',[]);
  repeat+=a.deck.filter(m=>history.includes(m.id)).length;
  fresh+=b.deck.filter(m=>history.includes(m.id)).length;
 }
 assert.ok(repeat<fresh*.65,`recent: ${repeat}; baseline: ${fresh}`);
});
test('rotation never blocks a small catalog',()=>{
 const pool=Array.from({length:25},(_,i)=>movie(i+1));
 const c={...DEFAULT_CONFIG,duels:20};
 assert.equal(selectMovies(pool,c,Math.random,'movie',pool.map(m=>m.id)).status,'ready');
});

test('general TV rotation prevents three consecutive appearances with ample recognizable pool',async()=>{
 const {selectTvSeries}=await import('../lib/selection.mjs');
 const names=['The Flash','House','The Mentalist','Friends','Seinfeld','Breaking Bad'];
 const pool=Array.from({length:95},(_,i)=>({...movie(i+1),title:names[i]||'Popular show '+i,votes:90000-i*350,score:8.5,decades:[2000],audience:{anime:false,kids:false}}));
 let history=[],appearances=new Map(),previous=[];
 for(let round=0;round<3;round++){
  const r=selectTvSeries(pool,{...DEFAULT_CONFIG,duels:20},()=>.45,history);
  assert.equal(r.status,'ready');
  const ids=r.deck.map(m=>m.id);
  assert.equal(ids.filter(id=>previous.includes(id)).length,0);
  for(const id of ids)appearances.set(id,(appearances.get(id)||0)+1);
  history=[...history.filter(id=>!ids.includes(id)),...ids].slice(-180);
  previous=ids;
 }
 for(let id=1;id<=3;id++)assert.ok((appearances.get(id)||0)<=1);
});
test('rotation reuses famous titles instead of exhausting catalog',async()=>{
 const {selectTvSeries}=await import('../lib/selection.mjs');
 const pool=Array.from({length:28},(_,i)=>({...movie(i+1),votes:10000-i*100,decades:[2000],audience:{anime:false,kids:false}}));
 let history=[];
 for(let i=0;i<5;i++){
  const r=selectTvSeries(pool,{...DEFAULT_CONFIG,duels:20},Math.random,history);
  assert.equal(r.status,'ready');
  const ids=r.deck.map(m=>m.id);
  history=[...history.filter(id=>!ids.includes(id)),...ids].slice(-180);
 }
});

test('filtered drama 2010 series rotate without violating filters',async()=>{
 const {selectTvSeries}=await import('../lib/selection.mjs');
 const pool=Array.from({length:62},(_,i)=>({...movie(i+1),year:2011,decades:[2010],votes:100000-i*500,genres:[18],audience:{anime:false,kids:false}}));
 const config={...DEFAULT_CONFIG,genre:'18',decade:'2010',duels:20};
 let history=[],previous=[];
 for(let round=0;round<3;round++){
  const result=selectTvSeries(pool,config,()=>.5,history);
  assert.equal(result.status,'ready');
  assert.ok(result.deck.every(m=>m.genres.includes(18)&&m.decades.includes(2010)));
  const ids=result.deck.map(m=>m.id);
  assert.equal(ids.filter(id=>previous.includes(id)).length,0,'avoid immediate repeats while enough alternatives exist');
  history=[...history.filter(id=>!ids.includes(id)),...ids].slice(-180);
  previous=ids;
 }
});

test('TV discovery rotates popular-page windows while retaining page one',async()=>{
 const {tvDiscoveryPages}=await import('../lib/tv.mjs');
 const first=tvDiscoveryPages([]);
 assert.equal(first[0],1);
 assert.equal(first.length,6);
 assert.equal(new Set(first).size,first.length);
 const windows=new Set(Array.from({length:15},(_,i)=>tvDiscoveryPages(Array.from({length:21},(_,j)=>i*21+j+1)).join(',')));
 assert.ok(windows.size>=4,'different recent histories should explore different popularity pages');
});
test('general normal TV excludes niche titles without removing recognizable alternatives',async()=>{
 const {selectTvSeries}=await import('../lib/selection.mjs');
 const pool=Array.from({length:65},(_,i)=>({...movie(i+1),title:i===0?'Niche classic':'Famous series '+i,votes:i===0?50:10000-i*100,decades:[2010],audience:{anime:false,kids:false}}));
 const r=selectTvSeries(pool,{...DEFAULT_CONFIG,duels:20},()=>.5,[]);
 assert.equal(r.status,'ready');
 assert.ok(!r.deck.some(m=>m.id===1));
});
