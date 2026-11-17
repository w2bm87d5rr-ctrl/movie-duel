'use client';
import {useState} from 'react';
import {choose,createDeck,difficulty,getRound,TOTAL_DUELS} from '../lib/game.mjs';
function Poster({movie}) {
 const [failed,setFailed]=useState(false);
 return failed ? <div className="poster fallback"><span>🎞</span>{movie.title}</div> : <img className="poster" src={movie.poster} alt={`Afiche de ${movie.title}`} onError={()=>setFailed(true)}/>;
}
export default function Game({movies}) {
 const [deck]=useState(()=>createDeck(movies));
 const [history,setHistory]=useState([]);
 const [started,setStarted]=useState(false);
 const round=getRound(deck,history);
 function undo(){setHistory(previous=>previous.slice(0,-1))}
 return <main>
  <header><a href="/" className="brand">MOVIE<span>DUEL</span><b>✦</b></a><span className="header-note">EL CINE SE ELIGE</span></header>
  {!started ? <section className="intro"><p className="eyebrow">TU PROPIO FESTIVAL DE CINE</p><h1>Grandes películas.<br/>Una sola <em>campeona.</em></h1><p className="description">Dos historias frente a frente. Elegí la que más te gusta y defendé a tu favorita durante 20 duelos.</p><button className="primary" onClick={()=>setStarted(true)}>Que empiece el duelo <span>↗</span></button><div className="intro-posters">{[deck[18],deck[15],deck[20]].map(movie=><div key={movie.id}><Poster movie={movie}/></div>)}</div><p className="muted">20 duelos · Rivales cada vez más aclamados · Podés deshacer</p></section> : round.finished ? <section className="result" aria-live="polite"><p className="eyebrow">20 DUELOS. UNA GRAN ELECCIÓN.</p><h1>Tu película<br/><em>campeona.</em></h1><div className="winner"><Poster key={round.champion.id} movie={round.champion}/><div><span className="crown">♛</span><h2>{round.champion.title}</h2><p>{round.champion.year} · Tu favorita de esta selección</p></div></div><div className="actions"><button className="primary" onClick={()=>setHistory([])}>Volver a jugar ↗</button><button className="secondary" onClick={undo}>↶ Deshacer última elección</button></div></section> : <section className="arena"><div className="round-info"><span className="eyebrow">DUELO {String(history.length+1).padStart(2,'0')} / 20</span><span>{difficulty(history.length)}</span></div><div className="progress" role="progressbar" aria-label="Duelos completados" aria-valuenow={history.length} aria-valuemin={0} aria-valuemax={20}><div style={{width:`${history.length/TOTAL_DUELS*100}%`}}/></div><div className="arena-title" aria-live="polite"><h1>¿Cuál se queda?</h1><p>Elegí tu favorita. La ganadora sigue en juego.</p></div><div className="duel">{[round.champion,round.challenger].map((movie,index)=><button className="movie" key={`${history.length}-${index}-${movie.id}`} onClick={()=>setHistory(previous=>choose(deck,previous,movie.id))} aria-label={`Elegir ${movie.title}`}><div className="poster-wrap"><Poster movie={movie}/><span className="pick">ELEGIR PELÍCULA ↗</span></div><div className="movie-info"><span>{index===0 && history.length>0 ? 'EN RACHA' : 'ASPIRANTE'}</span><h2>{movie.title}</h2><p>{movie.year}</p></div></button>)}<span className="versus" aria-hidden="true">VS</span></div><div className="arena-bottom"><button className="secondary" disabled={!history.length} onClick={undo}>↶ Deshacer</button><span>Sin respuestas correctas. Solo tus favoritas.</span></div></section>}
  <footer><span>Hecho para quienes aman el cine.</span><p>Afiches y datos de <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.</p></footer>
 </main>
}
