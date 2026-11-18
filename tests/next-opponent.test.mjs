import test from 'node:test';import assert from 'node:assert/strict';
import {nextOpponent,presentationTargets} from '../lib/next-opponent.mjs';
import {choose,createGame,undo,readSaved} from '../lib/game.mjs';
import {selectMovies} from '../lib/selection.mjs';import {localCatalog} from '../lib/tmdb.mjs';
for(const difficulty of ['normal','expert'])for(const duels of [5,20,40])test(`${difficulty}/${duels}: one exact next opponent, undo/resume and no future at final duel`,()=>{
 let game=createGame(selectMovies(localCatalog,{duels,difficulty},()=>0.42));const snapshot=structuredClone(game.deck);
 for(let round=0;round<duels;round++){
  const next=nextOpponent(game),targets=presentationTargets(game,'play');assert.equal(targets.length,round===duels-1?2:3);
  assert.deepEqual(game.deck,snapshot);
  if(round===duels-1)assert.equal(next,null);else assert.equal(next.id,game.deck[round+2].id);
  const before=game;game=choose(game,game.pair[round%2].id);if(next)assert.equal(game.pair[1].id,next.id);
  assert.deepEqual(undo(game),before);const saved=readSaved(JSON.stringify({version:2,config:game.config,game}));assert.deepEqual(saved.game,game);
 }
 assert.equal(nextOpponent(game),null);assert.deepEqual(presentationTargets(game,'play'),[game.pair[0].id]);
});
test('no game/reserves/history scanning or background prefetch in settings/home/blocked match',()=>{
 assert.equal(nextOpponent(null),null);assert.deepEqual(presentationTargets(null,'settings'),[]);assert.deepEqual(presentationTargets(null,'home'),[165,592]);
 const game=createGame(selectMovies(localCatalog,{duels:5},()=>0.2));assert.equal(nextOpponent({...game,blocked:true}),null);
 assert.deepEqual(presentationTargets(game,'settings'),[]);
});
