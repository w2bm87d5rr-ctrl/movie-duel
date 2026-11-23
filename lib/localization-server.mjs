import {hasToken,tmdb} from './tmdb.mjs';
import {localizedPresentation,seedPresentation} from './localization.mjs';
const cache=new Map(),pending=new Map(),queue=[];
let active=0;
export const LOCALIZATION_CONCURRENCY=4;
export const LOCALIZATION_BATCH_LIMIT=12;
export const LOCALIZATION_TIMEOUT_MS=4500;
function pump(){
 while(active<LOCALIZATION_CONCURRENCY&&queue.length){
  const job=queue.shift();active++;
  Promise.resolve().then(job.run).then(job.resolve,job.reject).finally(()=>{active--;pump()});
 }
}
function scheduled(run){return new Promise((resolve,reject)=>{queue.push({run,resolve,reject});pump()})}
async function resolveOne(id,signal){
 signal.throwIfAborted();
 const existing=cache.get(id);if(existing?.expiresAt>Date.now())return existing;
 if(pending.has(id))return pending.get(id);
 if(queue.length>=120)return null;
 const promise=scheduled(async()=>{
  signal.throwIfAborted();
  try{
   const data=await tmdb(`movie/${id}`,{language:'',append_to_response:'translations,alternative_titles,images'},fetch,AbortSignal.any([signal,AbortSignal.timeout(2500)]));
   // Validate shape instead of caching an incomplete response as a final answer.
   if(data.id!==id||!data.original_title)throw Error('Incomplete metadata');
   const value={...localizedPresentation(id,data),expiresAt:Date.now()+86400000};
   if(cache.size>=512)cache.delete(cache.keys().next().value);cache.set(id,value);return value;
  }catch{return null;}
 });
 pending.set(id,promise);
 try{return await promise}finally{if(pending.get(id)===promise)pending.delete(id)}
}
export async function getPresentations(ids,{timeoutMs=LOCALIZATION_TIMEOUT_MS,mode='movie'}={}){
 if(mode==='tv'){const {getTvPresentations}=await import('./tv-localization.mjs');return getTvPresentations(ids,{timeoutMs});}
 const unique=[...new Set(ids)];if(unique.length>LOCALIZATION_BATCH_LIMIT||!unique.every(id=>Number.isSafeInteger(id)&&id>0))throw Error('Invalid IDs');
 const fallback=id=>{const data=seedPresentation(id);return data?{...data,expiresAt:Date.now()+60000}:null};
 if(!hasToken())return Object.fromEntries(unique.map(id=>[id,fallback(id)]).filter(([,v])=>v));
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const results=await Promise.all(unique.map(async id=>{try{return [id,await resolveOne(id,controller.signal)||fallback(id)]}catch{return [id,fallback(id)]}}));
  return Object.fromEntries(results.filter(([,v])=>v));
 }finally{clearTimeout(timer)}
}
