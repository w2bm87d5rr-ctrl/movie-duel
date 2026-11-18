import seed from './localization-seed.json' with {type:'json'};
import {VERIFIED_POSTERS} from './localization-exceptions.mjs';
export const LOCALIZATION_VERSION=1;
export const REGIONS=['AR','MX','UY','CL','CO','PE','EC','BO','PY','VE','CR','PA','GT','SV','HN','NI','DO','CU'];
export const safePoster=url=>typeof url==='string'&&/^https:\/\/(image|media)\.tmdb\.org\/t\/p\/[^?#]+\.(jpg|png|webp)$/i.test(url);
const clean=value=>typeof value==='string'?value.trim().slice(0,300):'';
const usable=entry=>!/(working|literal|informal|unofficial|fan|bootleg)/i.test(entry.type||'');
export function regionalTitle(data){
 const original=clean(data.original_title||data.originalTitle);
 const translations=data.translations?.translations||data.translations||[];
 const alternatives=data.alternative_titles?.titles||data.alternative_titles||[];
 for(const country of REGIONS){
  const explicit=[...new Set(translations.filter(t=>t.iso_639_1==='es'&&t.iso_3166_1===country).map(t=>clean(t.data?.title)).filter(Boolean))];
  if(explicit.length===1)return {title:explicit[0],country,source:'translation'};
  const titles=[...new Set(alternatives.filter(t=>t.iso_3166_1===country&&usable(t)).map(t=>clean(t.title)).filter(Boolean))];
  if(!explicit.length&&titles.length===1)return {title:titles[0],country,source:'alternative_title'};
 }
 return {title:original,country:null,source:'original'};
}
export function localizedPresentation(id,data){
 const title=regionalTitle(data);
 const images=data.images?.posters||[];
 const quality=p=>p.width>=500&&p.height>=750&&p.aspect_ratio>0.55&&p.aspect_ratio<0.8;
 const ranked=list=>[...list].sort((a,b)=>(b.width*b.height-a.width*a.height)||(b.vote_count||0)-(a.vote_count||0)||a.file_path.localeCompare(b.file_path));
 let poster,posterSource;
 // TMDB's image language is not proof of a release market. Only reviewed paths
 // may be classified as Latin American artwork.
 for(const country of REGIONS){
  const approved=(VERIFIED_POSTERS[id]||[]).filter(p=>p.country===country);
  const found=ranked(images.filter(p=>quality(p)&&approved.some(a=>a.path===p.file_path)))[0];
  if(found){poster=found;posterSource='verified-'+country;break;}
 }
 if(!poster){poster=ranked(images.filter(p=>quality(p)&&p.iso_639_1===data.original_language))[0];posterSource=poster?'original-language':null;}
 return {...title,originalTitle:clean(data.original_title||data.originalTitle),poster:poster?`https://image.tmdb.org/t/p/w500${poster.file_path}`:null,posterSource,version:LOCALIZATION_VERSION};
}
export function seedPresentation(id){
 const data=seed[id];if(!data)return null;
 const verified=VERIFIED_POSTERS[id]?.[0];
 return {...regionalTitle(data),originalTitle:data.originalTitle,poster:verified?`https://image.tmdb.org/t/p/w500${verified.path}`:null,posterSource:verified?'verified-'+verified.country:null,version:LOCALIZATION_VERSION};
}
export function sanitizePresentation(input,now=Date.now()){
 if(!input||typeof input!=='object')return {};
 return Object.fromEntries(Object.entries(input).filter(([id,v])=>/^\d+$/.test(id)&&Number.isSafeInteger(Number(id))&&Number(id)>0&&v?.version===LOCALIZATION_VERSION&&v.expiresAt>now&&clean(v.title)&&(!v.poster||safePoster(v.poster))).slice(0,512).map(([id,v])=>[id,{title:clean(v.title),originalTitle:clean(v.originalTitle),poster:v.poster||null,country:REGIONS.includes(v.country)?v.country:null,source:clean(v.source),posterSource:clean(v.posterSource),version:LOCALIZATION_VERSION,expiresAt:v.expiresAt}]));
}
export function presentMovie(movie,presentation={}){
 const saved=sanitizePresentation({[movie.id]:presentation[movie.id]})[movie.id];
 const fallback=seedPresentation(movie.id);
 return {...movie,title:saved?.title||fallback?.title||movie.originalTitle||movie.title,poster:saved?.poster||fallback?.poster||movie.poster,basePoster:movie.poster,posterResolved:Boolean(saved||fallback?.poster)};
}
