import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMatch} from '../lib/tmdb.mjs';
import {configIssue} from '../lib/config.mjs';
const person=id=>({id,name:`Persona ${id}`});
const film=id=>({id,title:`Film ${id}`,release_date:'1985-02-01',poster_path:'/film.jpg',genre_ids:[18],original_language:'en',vote_average:8,vote_count:500});
async function mocked(handler,run){
 const oldFetch=globalThis.fetch,oldToken=process.env.TMDB_READ_ACCESS_TOKEN;
 process.env.TMDB_READ_ACCESS_TOKEN='test-only';globalThis.fetch=handler;
 try{await run()}finally{globalThis.fetch=oldFetch;if(oldToken===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=oldToken}
}
test('incompatible combinations are rejected before network; input remains intact',async()=>{
 for(const count of [2,5,6]){
  const input={country:count===6?'':'FR',people:Array.from({length:count},(_,i)=>person(i+1)),language:'en',genre:'18',decade:'1980'};
  const saved=structuredClone(input);
  await mocked(()=>{throw Error('Must not query TMDB')},async()=>{
   assert.equal((await prepareMatch(input)).status,'invalid');assert.deepEqual(input,saved);
  });
 }
 assert.equal(configIssue({people:Array.from({length:5},(_,i)=>person(i+1))}), '');
 assert.equal(configIssue({country:'FR',people:[person(1)]}), '');
});
for(const role of ['cast','Director'])test(`large ${role} filmography: all 125 verified, max four requests, cached retry`,async()=>{
 const offset=role==='cast'?100000:200000;
 const films=Array.from({length:125},(_,i)=>film(offset+i));let active=0,max=0,details=0;
 await mocked(async(url,init)=>{
  if(url.includes('/movie_credits'))return Response.json({cast:role==='cast'?[...films,films[0]]:[],crew:role==='Director'?films.map(m=>({...m,job:'Director'})):[]});
  assert.ok(init.signal);details++;max=Math.max(max,++active);
  await new Promise(r=>setTimeout(r,1));active--;
  return Response.json({...film(Number(new URL(url).pathname.split('/').at(-1))),origin_country:['US'],production_countries:[{iso_3166_1:'FR'}]});
 },async()=>{
  const config={country:'FR',people:[person(offset)],duels:40,difficulty:'expert'};
  const r=await prepareMatch(config);assert.equal(r.status,'ready');assert.equal(details,125);assert.ok(max<=4&&max>1);
  assert.ok(r.deck.every(m=>m.countries.includes('FR')&&m.peopleIds.includes(offset)));
  assert.equal(new Set(r.deck.map(m=>m.id)).size,41);
  await prepareMatch(config);assert.equal(details,125,'all details reused within cache capacity');
 });
});
test('coproductions verified; origin alone accepted; absent/mismatching countries never invented',async()=>{
 const ids=Array.from({length:20},(_,i)=>300000+i);let calls=0;
 await mocked(async url=>{
  calls++;
  if(url.includes('/discover/movie')){assert.equal(new URL(url).searchParams.get('with_origin_country'),'FR');return Response.json({total_pages:1,results:ids.map(film)});}
  const id=Number(new URL(url).pathname.split('/').at(-1)),i=id-300000;
  return Response.json({...film(id),origin_country:i<4?['FR']:['US'],production_countries:i>=4&&i<8?[{iso_3166_1:'FR'}]:[]});
 },async()=>{
  const r=await prepareMatch({country:'FR',duels:5});assert.equal(r.status,'ready');assert.ok(r.deck.every(m=>m.id<300008));
  const longer=await prepareMatch({country:'FR',duels:20});assert.equal(longer.status,'insufficient');assert.equal(longer.available,7);
  assert.equal(calls,21,'discovery and verified details cached');
 });
});
test('bounded discovery does not claim insufficient or empty when more pages exist',async()=>{
 await mocked(async url=>{
  if(url.includes('/discover/movie'))return Response.json({total_pages:100,results:[film(400000+Number(new URL(url).searchParams.get('page')))]});
  return Response.json({...film(Number(new URL(url).pathname.split('/').at(-1))),origin_country:['FR']});
 },async()=>{
  const r=await prepareMatch({country:'FR',language:'en',duels:40});assert.equal(r.status,'error');assert.equal(r.code,'TMDB_SEARCH_INCOMPLETE');assert.ok(!r.available);assert.match(r.message,/no significa que no existan/);
 });
});
test('exhausted discovery with no verified country matches may report empty',async()=>{
 await mocked(async url=>Response.json(url.includes('/discover/movie')?{total_pages:1,results:[{...film(450001),original_language:'es'}]}:{...film(450001),original_language:'es',origin_country:['US']}),async()=>{
  assert.equal((await prepareMatch({country:'FR',language:'es',duels:5})).status,'empty');
 });
});
test('deadline aborts pending details; partial successes are never a shorter/empty match',async()=>{
 let aborted=0;
 await mocked(async(url,init)=>{
  if(url.includes('/movie_credits'))return Response.json({cast:Array.from({length:120},(_,i)=>film(500000+i)),crew:[]});
  return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{aborted++;reject(init.signal.reason)},{once:true}));
 },async()=>{
  const before=Date.now();const r=await prepareMatch({country:'FR',people:[person(500000)]},{timeoutMs:20});
  assert.equal(r.status,'error');assert.equal(r.code,'TMDB_SEARCH_TIMEOUT');assert.ok(Date.now()-before<1000);assert.ok(aborted>0);assert.ok(!r.available);
 });
});
test('detail failure cancels workers and never reports absence',async()=>{
 await mocked(async url=>url.includes('/movie_credits')?Response.json({cast:Array.from({length:10},(_,i)=>film(600000+i)),crew:[]}):new Response('',{status:503}),async()=>{
  const r=await prepareMatch({country:'FR',people:[person(600000)]});assert.equal(r.status,'error');assert.equal(r.code,'TMDB_UPSTREAM_ERROR');
 });
});
test('deadline also interrupts rate-limit waiting without exceeding the search budget',async()=>{
 let calls=0;
 await mocked(async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'1'}})},async()=>{
  const before=Date.now();const r=await prepareMatch({people:[person(700000)]},{timeoutMs:20});
  assert.equal(r.code,'TMDB_SEARCH_TIMEOUT');assert.equal(calls,1);assert.ok(Date.now()-before<500);
 });
});
