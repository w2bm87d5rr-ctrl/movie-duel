// One presentation decision per mounted poster. No game state is read or changed.
export function createPosterSession({base,initial,resolved,load,onChange,waitMs=1200,warmFallback=true}){
 let active=true,decided=false,timer;
 async function select(preferred){
  if(!active||decided)return;
  decided=true;clearTimeout(timer);
  for(const source of [...new Set([preferred,base].filter(Boolean))]){
   try{await load(source);if(active)onChange({source,status:'ready'});return;}catch{}
  }
  if(active)onChange({source:null,status:'failed'});
 }
 if(resolved)select(initial||base);
 else{
  // Warm the fallback without displaying it or delaying navigation.
  if(warmFallback)load(base).catch(()=>{});
  timer=setTimeout(()=>select(base),waitMs);
 }
 return {update(source,isResolved){if(isResolved)select(source||base)},dispose(){active=false;clearTimeout(timer)}};
}
const images=new Map();
export function preloadPoster(source){
 const cached=images.get(source);if(cached&&cached.expires>Date.now())return cached.promise;
 const entry={expires:Date.now()+300000};
 entry.promise=new Promise((resolve,reject)=>{
  const image=new Image();let settled=false;
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;if(error)reject(error);else resolve()};
  const timer=setTimeout(()=>finish(Error('Poster timeout')),2500);
  image.onload=()=>finish();image.onerror=()=>finish(Error('Poster unavailable'));image.src=source;
  if(image.complete&&image.naturalWidth>0)finish();
 });
 if(images.size>=128)images.delete(images.keys().next().value);images.set(source,entry);
 entry.promise.catch(()=>{if(images.get(source)===entry)images.delete(source)});
 return entry.promise;
}
