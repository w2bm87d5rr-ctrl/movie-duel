import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConfig,TV_GENRES} from '../lib/config.mjs';
import {normalizeSeries,tvDiscoveryArgs,isFictionSeries,seriesCountries,tvAudience,tvDecades} from '../lib/tv.mjs';
import {tvPresentation} from '../lib/tv-localization.mjs';
import {TV_VERIFIED_POSTERS} from '../lib/tv-localization-exceptions.mjs';
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

test('TV country search is opt-in and applies equally to every country',()=>{
 const config={genre:'10765',decade:'2010',difficulty:'normal',language:''};
 const global=tvDiscoveryArgs({...config,country:''});
 assert.equal('with_origin_country' in global,false);
 for(const country of ['AR','JP','ES','FR','KR']){
  const filtered=tvDiscoveryArgs({...config,country});
  assert.equal(filtered.with_origin_country,country);
  assert.equal(filtered.with_genres,'10765');
  assert.equal(filtered['first_air_date.gte'],'2000-01-01');
  assert.equal(tvDiscoveryArgs({...config,country},0,true)['vote_count.gte'],0);
 }
});
test('TV genre exclusions and scripted metadata protect fiction-only results',()=>{
 const example=normalizeSeries({id:1,name:'Fiction',first_air_date:'2010-01-01',poster_path:'/p.jpg',genre_ids:[18],type:'Scripted'});
 assert.equal(isFictionSeries(example),true);
 assert.equal(isFictionSeries({...example,type:'Reality'}),false);
 assert.equal(isFictionSeries({...example,genres:[99]}),false);
});
test('TV LATAM posters require verified regional paths, prefer AR then MX and fall back to original',()=>{
 const input={original_name:'Original',original_language:'en',translations:{translations:[]},images:{posters:[
  {file_path:'/en.jpg',iso_639_1:'en',width:500,height:750,aspect_ratio:.667},
  {file_path:'/ar.jpg',iso_639_1:'es',width:500,height:750,aspect_ratio:.667},
  {file_path:'/mx.jpg',iso_639_1:'es',width:500,height:750,aspect_ratio:.667}
 ]}};
 assert.equal(tvPresentation(888,input).posterSource,'original-language');
 TV_VERIFIED_POSTERS[888]=[{country:'MX',path:'/mx.jpg'},{country:'AR',path:'/ar.jpg'}];
 try{
  const translated=tvPresentation(888,input);
  assert.equal(translated.posterSource,'verified-AR');
  assert.equal(translated.poster,'https://image.tmdb.org/t/p/w500/ar.jpg');
 }finally{delete TV_VERIFIED_POSTERS[888]}
});

test('country filtering trusts real production over format origin, preserving co-productions',()=>{
 const greek={id:999,name:'Οι Συμμαθητές',original_name:'Οι Συμμαθητές',first_air_date:'2014-01-01',poster_path:'/p.jpg',origin_country:['AR'],production_countries:[{iso_3166_1:'GR'}],original_language:'el',genre_ids:[18],type:'Scripted'};
 const foreign=normalizeSeries(greek);
 assert.deepEqual(foreign.countries,['GR']);
 assert.deepEqual(foreign.originCountries,['AR']);
 assert.equal(selectMovies([foreign],{country:'AR',duels:5},()=>.5,'tv').available,0);
 assert.deepEqual(seriesCountries({...greek,production_countries:[{iso_3166_1:'GR'},{iso_3166_1:'AR'}]}),['GR','AR']);
 assert.deepEqual(seriesCountries({...greek,production_countries:[]}),['AR']);
});
test('international official TV translation is used for non-Latin originals only without LATAM title',()=>{
 const data={original_name:'Οι Συμμαθητές',original_language:'el',translations:{translations:[
  {iso_639_1:'en',iso_3166_1:'US',data:{name:'The Classmates'}},
  {iso_639_1:'es',iso_3166_1:'ES',data:{name:'Los compañeros'}}
 ]},images:{posters:[]}};
 assert.equal(tvPresentation(777,data).title,'The Classmates');
 data.translations.translations.push({iso_639_1:'es',iso_3166_1:'MX',data:{name:'Compañeros'}});
 assert.equal(tvPresentation(777,data).title,'Compañeros');
 data.translations.translations=[];
 assert.equal(tvPresentation(777,data).title,'Οι Συμμαθητές');
});

test('known professional wrestling programming cannot enter a fiction duel',()=>{
 const wrestling=normalizeSeries({id:67192,name:'New Japan Pro Wrestling',first_air_date:'2010-01-01',poster_path:'/p.jpg',genre_ids:[10759],type:'Scripted'});
 assert.equal(isFictionSeries(wrestling),false);
});

test('TV decade includes meaningful original-season years across premiere decade',()=>{
 const years=tvDecades({first_air_date:'1989-07-05',last_air_date:'1998-05-14',seasons:[
  {season_number:1,episode_count:5,air_date:'1989-07-05'},
  {season_number:2,episode_count:13,air_date:'1990-01-01'},
  {season_number:9,episode_count:22,air_date:'1997-09-01'}]});
 assert.deepEqual(years,[1980,1990]);
 assert.deepEqual(tvDecades({first_air_date:'1994-09-22',last_air_date:'2004-05-06',seasons:[]}),[1990,2000]);
});
test('TV anime and kids audience decisions keep adult western animation eligible',()=>{
 assert.deepEqual(tvAudience({id:456,genres:[16,35,10751],language:'en',originCountries:['US']}),{anime:false,kids:false});
 assert.deepEqual(tvAudience({id:123,genres:[16,10762],language:'en',originCountries:['US']}),{anime:false,kids:true});
 assert.deepEqual(tvAudience({id:4567,genres:[16,35],language:'ja',originCountries:['JP']}),{anime:true,kids:false});
});
test('TV normal excludes anime and kids, expert permits rare anime but not kids',()=>{
 const make=(id,audience)=>({id,title:'Show '+id,year:1996,decades:[1990],poster:'https://image.tmdb.org/t/p/w500/p.jpg',genres:[35,16],countries:['US'],language:'en',score:8,votes:1000+id,audience});
 const mainstream=Array.from({length:12},(_,i)=>make(i+100,{anime:false,kids:false}));
 const anime=make(500,{anime:true,kids:false});
 const kids=make(501,{anime:false,kids:true});
 const normal=selectMovies([...mainstream,anime,kids],{genre:'35',decade:'1990',duels:5,difficulty:'normal'},()=>.5,'tv');
 assert.equal(normal.status,'ready');
 assert.ok(normal.deck.every(x=>!x.audience.anime&&!x.audience.kids));
 const expert=selectMovies([...mainstream,anime,kids],{genre:'35',decade:'1990',duels:5,difficulty:'expert'},()=>.1,'tv');
 assert.equal(expert.status,'ready');
 assert.ok(expert.deck.every(x=>!x.audience.kids));
 assert.ok(expert.deck.filter(x=>x.audience.anime).length<=1);
});

test('general TV comedy caps adult animation and excludes untagged kids cartoon',()=>{
 assert.equal(tvAudience({id:4229,genres:[16,35,10765],language:'en',originCountries:['US']}).kids,true);
 const make=(id,animated)=>({id,title:'Series '+id,year:1996,decades:[1990],poster:'https://image.tmdb.org/t/p/w500/p.jpg',genres:animated?[16,35]:[35],countries:['US'],language:'en',score:8,votes:1000+id,audience:{anime:false,kids:false}});
 const pool=[...Array.from({length:20},(_,i)=>make(100+i,false)),...Array.from({length:12},(_,i)=>make(500+i,true))];
 const game=selectMovies(pool,{genre:'35',decade:'1990',duels:20,difficulty:'normal'},()=>.5,'tv');
 assert.equal(game.status,'ready');
 assert.ok(game.deck.filter(m=>m.genres.includes(16)).length<=5);
});
