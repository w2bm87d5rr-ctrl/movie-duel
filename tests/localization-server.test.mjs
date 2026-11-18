import test from 'node:test';
import assert from 'node:assert/strict';
import {getPresentations} from '../lib/localization-server.mjs';
test('53 movies: bounded batches/concurrency, cache, deduplication, original-language image query',async()=>{
 const original=globalThis.fetch,token=process.env.TMDB_READ_ACCESS_TOKEN;process.env.TMDB_READ_ACCESS_TOKEN='fixture-only';let active=0,max=0,calls=0;
 globalThis.fetch=async(url,init)=>{
  calls++;active++;max=Math.max(max,active);const u=new URL(url);assert.equal(u.searchParams.has('language'),false);assert.equal(init.headers.Authorization,'Bearer fixture-only');
  await new Promise(r=>setTimeout(r,5));active--;const id=Number(u.pathname.split('/').at(-1));
  return Response.json({id,original_title:`Original ${id}`,original_language:'en',translations:{translations:[{iso_639_1:'es',iso_3166_1:'AR',data:{title:`Argentina ${id}`}}]},images:{posters:[]}});
 };
 try{
  const ids=Array.from({length:53},(_,i)=>990000+i),start=Date.now();let result={};
  for(let i=0;i<ids.length;i+=12)Object.assign(result,await getPresentations(ids.slice(i,i+12)));
  assert.equal(Object.keys(result).length,53);assert.ok(max<=4);assert.ok(Date.now()-start<2000);assert.equal(calls,53);
  await Promise.all([getPresentations([990000,990000]),getPresentations([990001])]);assert.equal(calls,53);
  await assert.rejects(getPresentations(ids));
 }finally{globalThis.fetch=original;if(token===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=token}
});
test('upstream timeout/failure is recoverable and never produces an invented title',async()=>{
 const original=globalThis.fetch,token=process.env.TMDB_READ_ACCESS_TOKEN;process.env.TMDB_READ_ACCESS_TOKEN='fixture-only';
 globalThis.fetch=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
 try{const start=Date.now();assert.deepEqual(await getPresentations([880001],{timeoutMs:30}),{});assert.ok(Date.now()-start<500)}
 finally{globalThis.fetch=original;if(token===undefined)delete process.env.TMDB_READ_ACCESS_TOKEN;else process.env.TMDB_READ_ACCESS_TOKEN=token}
});
