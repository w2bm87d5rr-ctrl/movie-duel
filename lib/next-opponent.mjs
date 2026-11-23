// choose() consumes deck[history.length + 1] AFTER adding the current choice.
// Therefore exactly one future opponent is eligible before that choice.
export function nextOpponent(game){
 if(!game||game.blocked||game.history.length>=game.config.duels-1)return null;
 return game.deck[game.history.length+2]||null;
}
export function presentationTargets(game,view,mode='movie'){
 if(mode==='tv'&&view==='home')return [];
 if(view==='home')return [165,592];
 if(view!=='play'||!game)return [];
 const next=nextOpponent(game);
 return [...new Set([...game.pair.map(m=>m.id),...(next?[next.id]:[])])];
}
