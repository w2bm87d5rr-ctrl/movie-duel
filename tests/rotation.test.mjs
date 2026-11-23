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
