import {tmdb} from './tmdb.mjs';
import {REGIONS,LOCALIZATION_VERSION} from './localization.mjs';
import {TV_VERIFIED_POSTERS} from './tv-localization-exceptions.mjs';
const cache=new Map();
export function tvPresentation(id,data){
 const translations=data.translations?.translations||[];
 let title=data.original_name||data.name||'';
 let regional=false;
 for(const country of REGIONS){
  const translated=translations.find(t=>t.iso_639_1==='es'&&t.iso_3166_1===country)?.data?.name?.trim();
  if(translated){title=translated;regional=true;break;}
 }
 // If no official LATAM title exists and the original is written in a
 // non-Latin alphabet, prefer a verified TMDB English-language translation.
 // Never machine-translate or fabricate a name.
 if(!regional&&!/[A-Za-zÀ-ÿ]/u.test(title)){
  for(const region of ['US','GB','CA','AU']){
   const international=translations.find(t=>t.iso_639_1==='en'&&t.iso_3166_1===region)?.data?.name?.trim();
   if(international&&/[A-Za-z]/.test(international)){title=international;break;}
  }
 }
 const posters=(data.images?.posters||[]).filter(p=>p.width>=500&&p.height>=750&&p.aspect_ratio>.55&&p.aspect_ratio<.8);
 const ranked=items=>[...items].sort((a,b)=>(b.width*b.height-a.width*a.height)||(b.vote_count||0)-(a.vote_count||0)||a.file_path.localeCompare(b.file_path));
 // Same evidence standard as film: Spanish-language artwork alone does not
 // prove a LATAM release. Use reviewed region-specific poster paths only.
 let selected=null,posterSource=null,country=null;
 for(const region of REGIONS){
  const approved=(TV_VERIFIED_POSTERS[id]||[]).filter(p=>p.country===region);
  selected=ranked(posters.filter(p=>approved.some(a=>a.path===p.file_path)))[0];
  if(selected){posterSource='verified-'+region;country=region;break;}
 }
 if(!selected){
  selected=ranked(posters.filter(p=>p.iso_639_1===data.original_language))[0];
  posterSource=selected?'original-language':null;
 }
 return {title,originalTitle:data.original_name||'',poster:selected?'https://image.tmdb.org/t/p/w500'+selected.file_path:null,source:'tv-translation',posterSource,country,version:LOCALIZATION_VERSION,expiresAt:Date.now()+86400000};
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
