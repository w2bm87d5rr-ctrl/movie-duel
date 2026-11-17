import {normalizeConfig} from './config.mjs';
import {validMovie} from './selection.mjs';
export const STORAGE_KEY='movie-duel:v2';
export function createGame(selection) {
 if(selection.status!=='ready') throw Error('La selección no está lista.');
 return {config:selection.config,deck:selection.deck,reserves:selection.reserves||[],history:[],pair:selection.deck.slice(0,2),failedIds:[],blocked:false};
}
export function choose(game,id) {
 if(!game || game.blocked || game.history.length>=game.config.duels || !game.pair.some(m=>m.id===id)) return game;
 const winner=game.pair.find(m=>m.id===id);
 const history=[...game.history,{pair:game.pair,winner:id}];
 return {...game,history,pair:history.length===game.config.duels ? [winner] : [winner,game.deck[history.length+1]]};
}
export function undo(game) {
 if(!game?.history.length) return game;
 const previous=game.history.at(-1);
 return {...game,history:game.history.slice(0,-1),pair:previous.pair,blocked:false};
}
export function replaceFailedPoster(game,id) {
 if(!game || !game.pair.some(m=>m.id===id)) return game;
 const failedIds=[...new Set([...game.failedIds,id])];
 const used=new Set([...game.deck,...game.history.flatMap(h=>h.pair)].map(m=>m.id));
 if(game.history.length===game.config.duels) return {...game,failedIds,blocked:true};
 const replacement=game.reserves.find(m=>!failedIds.includes(m.id)&&!used.has(m.id));
 if(!replacement) return {...game,failedIds,blocked:true};
 return {...game,failedIds,blocked:false,pair:game.pair.map(m=>m.id===id ? replacement : m),reserves:game.reserves.filter(m=>m.id!==replacement.id)};
}
export function readSaved(raw) {
 try {
  const value=JSON.parse(raw);
  if(value?.version!==2) return null;
  const config=normalizeConfig(value.config);
  let game=value.game;
  if(game) {
   const settings=normalizeConfig(game.config);
   const all=[...(game.deck||[]),...(game.reserves||[]),...(game.pair||[]),...(game.history||[]).flatMap(h=>h.pair||[])];
   const finished=game.history?.length===settings.duels;
   if(!Array.isArray(game.deck)||game.deck.length!==settings.duels+1||new Set(game.deck.map(m=>m.id)).size!==game.deck.length||!all.every(validMovie)||!Array.isArray(game.history)||game.history.length>settings.duels||!Array.isArray(game.pair)||game.pair.length!==(finished?1:2)||!Array.isArray(game.failedIds)||!game.failedIds.every(Number.isSafeInteger)||!game.history.every(h=>h.pair?.length===2&&h.pair[0].id!==h.pair[1].id&&h.pair.some(m=>m.id===h.winner))) game=null;
   else game={...game,config:settings,blocked:Boolean(game.blocked)};
  }
  return {config,game};
 } catch {return null;}
}
