import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMatch,searchPeople,tmdb} from '../lib/tmdb.mjs';
const originalFetch=globalThis.fetch;
const originalToken=process.env.TMDB_READ_ACCESS_TOKEN;
function movie(id,extra={}){return {id,title:`Película ${id}`,release_date:'1985-05-01',poster_path:`/poster-${id}.jpg`,genre_ids:[35],origin_country:['FR'],original_language:'fr',vote_average:8,vote_count:500,...extra}}
function mock(fn){process.env.TMDB_READ_ACCESS_TOKEN='test-only';globalThis.fetch=async(url,init)=>{
 assert.equal(init.headers.Authorization,'Bearer test-only');return fn(new URL(url));
};}
function reset(){globalThis.fetch=originalFetch;if(originalToken===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=originalToken;}
test('live provider paginates, excludes documentary, deduplicates and preserves country/language',async()=>{
 const calls=[];
 mock(url=>{calls.push(url);const page=Number(url.searchParams.get('page'));return Response.json({total_pages:2,results:[...Array.from({length:20},(_,i)=>movie(i+(page-1)*20+1)),movie(1),movie(900,{genre_ids:[99]}),movie(901,{poster_path:null})]})});
 try {
  const result=await prepareMatch({duels:20,country:'FR',language:'fr',genre:'35',decade:'1980'});
  assert.equal(result.status,'ready');assert.equal(calls.length,2);
  assert.ok(calls.every(url=>url.searchParams.get('with_origin_country')==='FR'&&url.searchParams.get('with_original_language')==='fr'&&url.searchParams.get('without_genres')==='99'));
  assert.equal(new Set(result.deck.map(m=>m.id)).size,21);assert.ok(!result.deck.some(m=>[900,901].includes(m.id)));
 }finally{reset()}
});
test('live movie credits combine actors OR directors, verify production countries and skip other crew',async()=>{
 const ids=[777777,888888];
 mock(url=>{
  if(url.pathname.includes('/movie_credits')){
   const person=Number(url.pathname.split('/')[3]);const offset=person===ids[0]?1000:2000;
   return Response.json({cast:[...Array.from({length:5},(_,i)=>movie(offset+i))],crew:[movie(offset+5,{job:'Director'}),movie(offset+6,{job:'Producer'})]});
  }
  const id=Number(url.pathname.split('/').at(-1));return Response.json(movie(id,{genres:[{id:35}],origin_country:[],production_countries:[{iso_3166_1:'ES'}]}));
 });
 try {
  const result=await prepareMatch({duels:10,country:'ES',people:ids.map(id=>({id,name:'Persona'}))});
  assert.equal(result.status,'ready');assert.ok(result.deck.every(m=>m.countries.includes('ES')));
  assert.ok(result.deck.some(m=>m.peopleIds.includes(ids[0]))&&result.deck.some(m=>m.peopleIds.includes(ids[1])));
  assert.ok(!result.deck.some(m=>[1006,2006].includes(m.id)));
 }finally{reset()}
});
test('search uses TMDB person endpoint, localized professions and optional portrait',async()=>{
 mock(()=>Response.json({results:[{id:777,name:'Persona de prueba',known_for_department:'Directing',profile_path:'/profile.jpg'},{id:778,name:'Producción',known_for_department:'Production'}]}));
 try {
  const result=await searchPeople('Persona de prueba');assert.equal(result.length,1);assert.equal(result[0].department,'Dirección');assert.ok(result[0].photo.endsWith('/profile.jpg'));
 }finally{reset()}
});
test('provider error keeps filters and does not silently fall back to partial filmographies',async()=>{
 mock(()=>new Response('',{status:503}));
 try{assert.equal((await prepareMatch({duels:10,people:[{id:999999,name:'Persona'}]})).status,'error')}finally{reset()}
});
test('bounded rate-limit retry then cache avoids redundant network calls',async()=>{
 let count=0;
 mock(()=>++count===1?new Response('',{status:429,headers:{'retry-after':'0'}}):Response.json({ok:true}));
 try{assert.deepEqual(await tmdb('test/cache'),{ok:true});assert.deepEqual(await tmdb('test/cache'),{ok:true});assert.equal(count,2)}finally{reset()}
});
test('failed authentication never advertises a working live catalogue',async()=>{
 mock(()=>new Response('',{status:401}));
 try {
  const {getOptions}=await import('../lib/tmdb.mjs');
  await assert.rejects(getOptions(),e=>e.code==='TMDB_AUTH_ERROR');
 }finally{reset()}
});
test('authenticated metadata includes genres and localized countries/languages only after success',async()=>{
 mock(url=>Response.json(url.pathname.endsWith('/countries')?[{iso_3166_1:'AR'},{iso_3166_1:'FR'}]:url.pathname.endsWith('/languages')?[{iso_639_1:'es'},{iso_639_1:'fr'}]:{genres:[{id:18,name:'Drama'},{id:35,name:'Comedia'},{id:99,name:'Documental'}]}));
 try {
  const {getOptions}=await import('../lib/tmdb.mjs');const options=await getOptions();
  assert.equal(options.source,'tmdb');assert.ok(!('catalogSize' in options));
  assert.deepEqual(options.genres.map(g=>g.id),['18','35']);assert.ok(options.countries.some(c=>c.name==='Argentina'));
  assert.ok(options.languages.some(l=>l.name==='español'));
 }finally{reset()}
});
test('discovery preserves country evidence even when TMDB omits origin_country in results',async()=>{
 mock(()=>Response.json({total_pages:1,results:Array.from({length:20},(_,i)=>movie(50000+i,{origin_country:undefined,original_language:'es'}))}));
 try {
  const result=await prepareMatch({duels:10,country:'AR',language:'es'});
  assert.equal(result.status,'ready');assert.ok(result.deck.every(m=>m.countries.includes('AR')&&m.language==='es'));
 }finally{reset()}
});
