import test from 'node:test';
import assert from 'node:assert/strict';
import {createPosterSession} from '../lib/stable-poster.mjs';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('cached metadata never displays intermediate base and stays fixed',async()=>{
 const shown=[],loads=[];const s=createPosterSession({base:'base',initial:'regional',resolved:true,load:async x=>loads.push(x),onChange:x=>shown.push(x)});await tick();s.update('later',true);await tick();assert.deepEqual(loads,['regional']);assert.deepEqual(shown,[{source:'regional',status:'ready'}]);s.dispose();
});
test('pending localization uses placeholder until final preloaded image',async()=>{
 const shown=[];let complete;const s=createPosterSession({base:'base',resolved:false,waitMs:100,load:x=>x==='base'?Promise.resolve():new Promise(r=>complete=r),onChange:x=>shown.push(x)});await tick();assert.equal(shown.length,0);s.update('regional',true);await tick();assert.equal(shown.length,0);complete();await tick();assert.equal(shown[0].source,'regional');s.dispose();
});
test('deadline fallback is stable even if localization arrives later',async()=>{
 const shown=[];const s=createPosterSession({base:'base',resolved:false,waitMs:10,load:async()=>{},onChange:x=>shown.push(x)});await new Promise(r=>setTimeout(r,20));s.update('late',true);await tick();assert.deepEqual(shown,[{source:'base',status:'ready'}]);s.dispose();
});
test('localized download fails: only preloaded fallback is displayed',async()=>{
 const shown=[];const s=createPosterSession({base:'base',initial:'bad',resolved:true,load:async x=>{if(x==='bad')throw Error()},onChange:x=>shown.push(x)});await tick();assert.deepEqual(shown,[{source:'base',status:'ready'}]);s.dispose();
});
test('all images fail: finite failure state, no broken image',async()=>{
 const shown=[];const s=createPosterSession({base:'bad',resolved:true,load:async()=>{throw Error()},onChange:x=>shown.push(x)});await tick();assert.deepEqual(shown,[{source:null,status:'failed'}]);s.dispose();
});
test('fast navigation ignores old completion and cancels fallback timer',async()=>{
 const shown=[];let complete;const s=createPosterSession({base:'base',initial:'regional',resolved:true,load:()=>new Promise(r=>complete=r),onChange:x=>shown.push(x)});s.dispose();complete();await tick();assert.equal(shown.length,0);
 const waiting=createPosterSession({base:'base',resolved:false,waitMs:5,load:async()=>{},onChange:x=>shown.push(x)});waiting.dispose();await new Promise(r=>setTimeout(r,15));assert.equal(shown.length,0);
});
test('image cache deduplicates successful preloads and evicts failures',async()=>{
 const {preloadPoster}=await import('../lib/stable-poster.mjs');const Original=globalThis.Image;let count=0;
 globalThis.Image=class{constructor(){count++}set src(value){queueMicrotask(()=>value.includes('bad')?this.onerror?.():this.onload?.())}};
 try{
  await Promise.all([preloadPoster('cached-test'),preloadPoster('cached-test')]);await preloadPoster('cached-test');assert.equal(count,1);
  await assert.rejects(preloadPoster('bad-test'));await assert.rejects(preloadPoster('bad-test'));assert.equal(count,3);
 }finally{if(Original===undefined)delete globalThis.Image;else globalThis.Image=Original}
});
