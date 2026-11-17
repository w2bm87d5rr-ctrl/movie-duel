export const TOTAL_DUELS = 20;
export function createDeck(movies) {
 if (movies.length !== TOTAL_DUELS + 1) throw new Error('Se necesitan 21 películas.');
 return [...movies].sort((a,b)=>a.score-b.score || a.id-b.id);
}
export function getRound(deck, history) {
 const champion = history.at(-1) ?? deck[0].id;
 return {champion:deck.find(movie=>movie.id===champion),challenger:deck[history.length+1],finished:history.length===TOTAL_DUELS};
}
export function choose(deck, history, id) {
 const round = getRound(deck,history);
 if (round.finished || ![round.champion.id,round.challenger.id].includes(id)) return history;
 return [...history,id];
}
export function difficulty(completed) {
 return completed < 7 ? 'Primeros favoritos' : completed < 14 ? 'Decisiones difíciles' : 'Leyendas del cine';
}
