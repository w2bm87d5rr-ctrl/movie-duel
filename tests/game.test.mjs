import test from 'node:test';
import assert from 'node:assert/strict';
import {movies} from '../lib/movies.mjs';
import {choose,createDeck,getRound} from '../lib/game.mjs';
const deck=createDeck(movies);
test('20 duels visit 21 unique movies, progressively acclaimed challengers',()=>{
 assert.equal(new Set(deck.map(movie=>movie.id)).size,21);
 let history=[];
 for(let index=0;index<20;index++){
  const round=getRound(deck,history);
  assert.equal(round.finished,false);
  assert.notEqual(round.champion.id,round.challenger.id);
  if(index>0) assert.ok(round.challenger.score>=deck[index].score);
  history=choose(deck,history,round.challenger.id);
 }
 assert.equal(getRound(deck,history).finished,true);
 assert.equal(getRound(deck,history).champion.id,deck[20].id);
 assert.equal(choose(deck,history,deck[0].id),history);
});
test('undo restores either previous champion and challenger, including final duel',()=>{
 let history=[];
 for(let i=0;i<20;i++){
  const before=getRound(deck,history);
  const next=choose(deck,history,i%2 ? before.champion.id : before.challenger.id);
  assert.deepEqual(getRound(deck,next.slice(0,-1)),before);
  history=next;
 }
 assert.equal(getRound(deck,history.slice(0,-1)).finished,false);
});
test('invalid selections cannot advance a duel',()=>assert.deepEqual(choose(deck,[], -1),[]));
