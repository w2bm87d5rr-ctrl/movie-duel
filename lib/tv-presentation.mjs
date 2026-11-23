import {sanitizePresentation} from './localization.mjs';
export function presentTv(series,presentation={}){
 const saved=sanitizePresentation({[series.id]:presentation[series.id]})[series.id];
 return {...series,title:saved?.title||series.title,poster:saved?.poster||series.poster,basePoster:series.poster,posterResolved:Boolean(saved)};
}
