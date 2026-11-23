import {tmdb} from './tmdb.mjs';
import {REGIONS,LOCALIZATION_VERSION} from './localization.mjs';
const cache=new Map();
export function tvPresentation(id,data){
 const translations=data.translations?.translations||[];
 let title=data.original_name||data.name||'';
 for(const country of REGIONS){
  const translated=translations.find(t=>t.iso_639_1==='es'&&t.iso_3166_1===country)?.data?.name?.trim();
  if(translated){title=translated;break;}
 }
 const posters=(data.images?.posters||[]).filter(p=>p.width>=500&&p.height>=750&&p.aspect_ratio>.55&&p.aspect_ratio<.8);
 const original=posters.filter(p=>p.iso_639_1===data.original_language).sort((a,b)=>b.width*b.height-a.width*a.height)[0];
 return {title,originalTitle:data.original_name||'',poster:original?'https://image.tmdb.org/t/p/w500'+original.file_path:null,source:'tv-translation',posterSource:original?'original-language':null,country:null,version:LOCALIZATION_VERSION,expiresAt:Date.now()+86400000};
}
export async function getTvPresentations(ids,{timeoutMs=4500}={}){
 const unique=[...new Set(ids)];
 if(unique.length>12||!unique.every(id=>Number.isSafeInteger(id)&&id>0))throw Error('Invalid IDs');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  return Object.fromEntries((await Promise.all(unique.map(async id=>{
   const existing=cache.get(id);if(existing?.expiresAt>Date.now())return [id,existing];
   try{
    const data=await tmdb('tv/'+id,{language:'',append_to_response:'translations,images'},fetch,controller.signal);
    if(data.id!==id||!data.original_name)return [id,null];
    const value=tvPresentation(id,data);cache.set(id,value);return [id,value];
   }catch{return [id,null]}
  }))).filter(([,v])=>v));
 }finally{clearTimeout(timer)}
}
