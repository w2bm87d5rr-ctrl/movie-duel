import test from 'node:test';
import assert from 'node:assert/strict';
import {regionalTitle,localizedPresentation,seedPresentation,presentMovie,sanitizePresentation} from '../lib/localization.mjs';
import {createGame,choose,undo,readSaved} from '../lib/game.mjs';
import {selectMovies} from '../lib/selection.mjs';
import {localCatalog} from '../lib/tmdb.mjs';
for(const [id,title] of [[771,'Mi pobre angelito'],[562,'Duro de matar'],[165,'Volver al Futuro II'],[600,'Nacido para matar']])test(`real public TMDB snapshot ${id}: regional title`,()=>assert.equal(seedPresentation(id).title,title));
test('country priority, ambiguity, Spain exclusion and original fallback',()=>{
 const data={original_title:'Original',translations:{translations:[{iso_639_1:'es',iso_3166_1:'ES',data:{title:'España'}},{iso_639_1:'es',iso_3166_1:'MX',data:{title:'México'}}]},alternative_titles:{titles:[{iso_3166_1:'AR',title:'Argentina'}]}};
 assert.equal(regionalTitle(data).title,'Argentina');data.alternative_titles.titles=[];assert.equal(regionalTitle(data).title,'México');data.translations.translations.pop();assert.equal(regionalTitle(data).title,'Original');
 data.alternative_titles.titles=[{iso_3166_1:'AR',title:'Uno'},{iso_3166_1:'AR',title:'Dos'},{iso_3166_1:'AR',title:'Fan',type:'unofficial'}];assert.equal(regionalTitle(data).title,'Original');
});
test('verified regional poster, quality floor and unverified Spanish fallback',()=>{
 const image=(file_path,iso_639_1='es',width=1000)=>({file_path,iso_639_1,width,height:width*1.5,aspect_ratio:2/3});
 const data={original_title:'Original',original_language:'en',images:{posters:[image('/ygKImi2jzm0j00W3JXBxvxdUM8n.jpg'),image('/spain.jpg'),image('/english.jpg','en')]}};
 assert.match(localizedPresentation(165,data).poster,/ygKImi/);
 assert.match(localizedPresentation(562,data).poster,/english/);
 data.images.posters[0].width=200;assert.match(localizedPresentation(165,data).poster,/english/);
 data.images.posters=[image('/spain.jpg')];assert.equal(localizedPresentation(562,data).poster,null);
});
test('legacy games, 40 duels, order, IDs, winners, continuation and undo remain identical',()=>{
 const selected=selectMovies(localCatalog,{duels:40,difficulty:'normal'},()=>0.42);let game=createGame(selected);let control=structuredClone(game);
 const overlay=Object.fromEntries(game.deck.map(m=>[m.id,{title:'Título regional',poster:'https://image.tmdb.org/t/p/w500/local.jpg',version:1,expiresAt:Date.now()+60000}]));
 const original=JSON.stringify(game);game.deck.forEach(m=>presentMovie(m,overlay));assert.equal(JSON.stringify(game),original);
 for(let n=0;n<40;n++){const id=game.pair[n%2].id;game=choose(game,id);control=choose(control,id);assert.deepEqual(game,control)}
 assert.deepEqual(readSaved(JSON.stringify({version:2,config:game.config,game})).game,control);
 assert.deepEqual(readSaved(JSON.stringify({version:2,config:game.config,game,presentation:overlay})).game,control);
 for(let n=0;n<40;n++){game=undo(game);control=undo(control);assert.deepEqual(game,control)}
 assert.deepEqual(game.deck.map(m=>m.id),selected.deck.map(m=>m.id));
 assert.deepEqual(sanitizePresentation({1:{title:'Bad',version:1,expiresAt:Date.now()+60000,poster:'javascript:bad'}}),{});
});
