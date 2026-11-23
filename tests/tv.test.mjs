import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConfig,TV_GENRES} from '../lib/config.mjs';
import {normalizeSeries} from '../lib/tv.mjs';
import {tvPresentation} from '../lib/tv-localization.mjs';
import {selectMovies} from '../lib/selection.mjs';
import {createGame,choose,undo,readSaved,STORAGE_KEY,TV_STORAGE_KEY} from '../lib/game.mjs';

test('TV genres are distinct from film genres and film configuration is unchanged',()=>{
 assert.equal(normalizeConfig({genre:'10765'},'tv').genre,'10765');
 assert.equal(normalizeConfig({genre:'10765'}).genre,'');
 assert.equal(normalizeConfig({genre:'878'}).genre,'878');
 assert.ok(TV_GENRES.some(g=>g.id==='10765'));
 assert.notEqual(STORAGE_KEY,TV_STORAGE_KEY);
});
test('TMDB series map to the existing duel contract',()=>{
 const series=normalizeSeries({id:1396,name:'Breaking Bad',original_name:'Breaking Bad',first_air_date:'2008-01-20',poster_path:'/abc.jpg',genres:[{id:18}],origin_country:['US'],original_language:'en',vote_average:8,vote_count:100,type:'Scripted'},[17419]);
 assert.equal(series.title,'Breaking Bad');
 assert.equal(series.year,2008);
 assert.deepEqual(series.peopleIds,[17419]);
 assert.deepEqual(series.countries,['US']);
 assert.deepEqual(series.genres,[18]);
});
test('TV selections, duel, undo and independent saved progress work',()=>{
 const input=Array.from({length:7},(_,i)=>normalizeSeries({id:100+i,name:'Series '+i,original_name:'Series '+i,first_air_date:'2018-01-01',poster_path:'/abc.jpg',genre_ids:[10765],origin_country:['US'],original_language:'en',vote_average:8,vote_count:100,type:'Scripted'}));
 const selection=selectMovies(input,{genre:'10765',duels:5},()=>.5,'tv');
 assert.equal(selection.status,'ready');
 const game=createGame(selection);
 const next=choose(game,game.pair[0].id);
 assert.equal(next.history.length,1);
 assert.equal(undo(next).history.length,0);
 const restored=readSaved(JSON.stringify({version:2,config:selection.config,game:next}),'tv');
 assert.equal(restored.game.history.length,1);
 assert.equal(restored.config.genre,'10765');
});
test('TV LATAM translation takes priority over Spain and original title',()=>{
 const item=tvPresentation(1,{original_name:'Original',original_language:'en',translations:{translations:[{iso_639_1:'es',iso_3166_1:'ES',data:{name:'España'}},{iso_639_1:'es',iso_3166_1:'AR',data:{name:'Argentina'}}]},images:{posters:[]}});
 assert.equal(item.title,'Argentina');
 assert.equal(item.poster,null);
});
