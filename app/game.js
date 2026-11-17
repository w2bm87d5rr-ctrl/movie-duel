'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {DEFAULT_CONFIG,DECADES,GENRES,normalizeConfig} from '../lib/config.mjs';
import {choose,createGame,readSaved,replaceFailedPoster,STORAGE_KEY,undo} from '../lib/game.mjs';

function Picker({label,options=[],value,onChange,placeholder='Buscar…',multiple=false,remote=false,disabled=false}) {
 const uid=useId();
 const [query,setQuery]=useState('');
 const [open,setOpen]=useState(false);
 const [results,setResults]=useState([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [active,setActive]=useState(-1);
 const wrapper=useRef(null);
 const input=useRef(null);
 useEffect(()=>{
  if(!remote) return;
  setResults([]);setError('');
  if(query.trim().length<2){setLoading(false);return;}
  const controller=new AbortController();
  setLoading(true);
  const timeout=setTimeout(async()=>{
   try {
    const response=await fetch(`/api/people?q=${encodeURIComponent(query.trim())}`,{signal:controller.signal});
    const data=await response.json();
    if(!response.ok) throw Error(data.error||'No pudimos buscar personas.');
    if(!controller.signal.aborted)setResults(data.people||[]);
   }catch(e){if(!controller.signal.aborted)setError('No pudimos buscar personas. Intentá de nuevo.');}
   finally {if(!controller.signal.aborted)setLoading(false);}
  },300);
  return ()=>{clearTimeout(timeout);controller.abort()};
 },[query,remote]);
 useEffect(()=>{
  function close(event){if(!wrapper.current?.contains(event.target))setOpen(false)}
  document.addEventListener('pointerdown',close);
  return ()=>document.removeEventListener('pointerdown',close);
 },[]);
 const selected=multiple?value:[];
 const source=remote?results:options;
 const clean=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('es');
 const shown=source.filter(option=>(remote||clean(option.name).includes(clean(query)))&&!selected.some(p=>p.id===option.id)).slice(0,60);
 const current=multiple?'':options.find(o=>o.id===value)?.name||'';
 function pick(option){onChange(multiple?[...selected,option]:option.id);setQuery('');setActive(-1);setOpen(false);input.current?.focus();}
 return <div className="field picker" ref={wrapper}>
  <label htmlFor={uid}>{label}</label>
  {multiple&&selected.length>0&&<div className="chips">{selected.map(person=><span key={person.id}>{person.name}<button type="button" aria-label={`Quitar ${person.name}`} onClick={()=>onChange(selected.filter(p=>p.id!==person.id))}>×</button></span>)}</div>}
  <div className="search-input"><input ref={input} id={uid} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${uid}-list`} aria-activedescendant={active>=0&&shown[active]?`${uid}-${active}`:undefined} autoComplete="off" value={open?query:current} disabled={disabled} placeholder={multiple&&selected.length===5?'Máximo de cinco personas':placeholder} onFocus={()=>{setOpen(true);setActive(-1)}} onChange={e=>{setQuery(e.target.value);setActive(-1);setOpen(true)}} onKeyDown={e=>{
   if(e.key==='Escape'){setOpen(false);setQuery('');}
   if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(a=>Math.min(a+1,shown.length-1));}
   if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0));}
   if(e.key==='Enter'&&open&&active>=0&&shown[active]){e.preventDefault();pick(shown[active]);}
   if(e.key==='Tab'){setOpen(false);setQuery('');}
  }}/>{!multiple&&value&&<button type="button" aria-label={`Quitar filtro de ${label}`} onClick={()=>{onChange('');setQuery('')}}>×</button>}</div>
  {open&&!disabled&&<div className="suggestions" id={`${uid}-list`} role="listbox" aria-label={label}>
   {!multiple&&<button type="button" role="option" aria-selected={!value} onClick={()=>pick({id:'',name:''})}>Cualquiera</button>}
   {remote&&query.trim().length<2?<p>Escribí al menos dos letras.</p>:loading?<p role="status">Buscando…</p>:error?<p role="alert">{error}</p>:shown.length===0?<p>Sin resultados para esta búsqueda.</p>:shown.map((option,index)=><button key={option.id} id={`${uid}-${index}`} type="button" role="option" aria-selected={active===index} className={active===index?'highlight':''} onClick={()=>pick(option)}>
    {option.photo&&<img src={option.photo} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>}<span>{option.name}{option.department&&<small>{option.department}</small>}</span>
   </button>)}
  </div>}
 </div>
}
function Confirm({onCancel,onConfirm}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current;dialog.showModal();return ()=>dialog.close()},[]);
 return <dialog ref={ref} onCancel={event=>{event.preventDefault();onCancel()}} aria-labelledby="confirm-title"><h2 id="confirm-title">¿Empezar otra partida?</h2><p>Tenés una partida en curso. Si empezás otra, perderás el progreso anterior.</p><div className="actions"><button className="primary" autoFocus onClick={onCancel}>SEGUIR JUGANDO</button><button className="secondary" onClick={onConfirm}>NUEVA PARTIDA</button></div></dialog>
}
function MatchProblem({problem,busy,onShorter,onModify,onRetry}){
 const ref=useRef(null);
 const heading=useRef(null);
 const uid=useId();
 const shorter=problem.status==='insufficient';
 const empty=problem.status==='empty';
 const title=shorter?'Podés jugar menos duelos':empty?'No hay suficientes películas':'No pudimos preparar la partida';
 const description=shorter?`Encontramos películas suficientes para ${problem.available} duelos con tu selección.`:empty?'No encontramos suficientes películas para comenzar con los filtros seleccionados.':problem.message;
 useEffect(()=>{
  const dialog=ref.current;
  const previousFocus=document.activeElement;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  dialog.showModal();
  heading.current.focus({preventScroll:true});
  return ()=>{
   dialog.close();
   document.body.style.overflow=previousOverflow;
   if(previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.matches(':disabled'))previousFocus.focus({preventScroll:true});
  };
 },[]);
 function trapFocus(event){
  if(event.key!=='Tab')return;
  const buttons=[...ref.current.querySelectorAll('button:not(:disabled)')];
  const first=buttons[0];const last=buttons.at(-1);const active=document.activeElement;
  if(!first){event.preventDefault();heading.current.focus();return;}
  if(event.shiftKey&&(active===first||!buttons.includes(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&(active===last||!buttons.includes(active))){event.preventDefault();first.focus();}
 }
 return <dialog className="match-problem" ref={ref} onKeyDown={trapFocus} aria-modal="true" aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-description`} onCancel={event=>{event.preventDefault();onModify()}}>
  <h2 ref={heading} tabIndex={-1} id={`${uid}-title`}>{title}</h2>
  <p id={`${uid}-description`}>{description}</p>
  <div className="actions">
   {shorter&&<button className="primary" disabled={busy} onClick={onShorter}>JUGAR {problem.available} DUELOS</button>}
   {!shorter&&!empty&&<button className="primary" disabled={busy} onClick={onRetry}>REINTENTAR</button>}
   <button className="secondary" onClick={onModify}>MODIFICAR FILTROS</button>
  </div>
 </dialog>
}
function Poster({movie,onReady,onFail,retry=0}){
 const [status,setStatus]=useState('loading');
 return <div className={`poster-frame ${status}`}>
  {status!=='failed'&&<img key={retry} src={movie.poster} alt={`Afiche de ${movie.title}`} width="500" height="750" fetchPriority="high" decoding="async" onLoad={()=>{setStatus('ready');onReady(movie.id)}} onError={()=>{setStatus('failed');onFail(movie.id)}}/>}
  {status!=='ready'&&<div className="poster-placeholder" role="status"><span className="film-icon" aria-hidden="true">✦</span>{status==='loading'?'Cargando afiche…':'Buscando otro afiche…'}</div>}
 </div>
}
export default function Game(){
 const [config,setConfig]=useState({...DEFAULT_CONFIG});
 const [game,setGame]=useState(null);
 const [view,setView]=useState('home');
 const [hydrated,setHydrated]=useState(false);
 const [options,setOptions]=useState({countries:[],languages:[],source:'catalog'});
 const [optionsError,setOptionsError]=useState(false);
 const [busy,setBusy]=useState(false);
 const [problem,setProblem]=useState(null);
 const [pending,setPending]=useState(null);
 const [storageError,setStorageError]=useState(false);
 const [loaded,setLoaded]=useState({});
 const [retry,setRetry]=useState(0);
 const latest=useRef({config,game});
 const inFlight=useRef(false);
 const titleRef=useRef(null);
 const startButtonRef=useRef(null);
 latest.current={config,game};
 useEffect(()=>{
  try {
   const restored=readSaved(localStorage.getItem(STORAGE_KEY));
   if(restored){setConfig(restored.config);setGame(restored.game);}
  }catch{setStorageError(true);}
  setHydrated(true);
  const controller=new AbortController();
  fetch('/api/options',{signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(setOptions).catch(()=>{if(!controller.signal.aborted)setOptionsError(true)});
  return ()=>controller.abort();
 },[]);
 useEffect(()=>{
  if(!hydrated)return;
  function save(){
   try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:2,...latest.current}));setStorageError(false)}catch{setStorageError(true)}
  }
  function hidden(){if(document.visibilityState==='hidden')save()}
  save();window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',hidden);
  return ()=>{window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',hidden)};
 },[config,game,hydrated]);
 useEffect(()=>{if(hydrated)titleRef.current?.focus()},[view,hydrated]);
 function update(key,value){setConfig(previous=>normalizeConfig({...previous,[key]:value}));setProblem(null)}
 const active=game&&game.history.length<game.config.duels;
 const finished=game&&game.history.length===game.config.duels;
 const advanced=config.people.length+Number(Boolean(config.country))+Number(Boolean(config.language));
 async function startMatch(settings){
  if(inFlight.current)return;
  inFlight.current=true;setBusy(true);setProblem(null);
  try {
   const response=await fetch('/api/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});
   const data=await response.json();
   if(!response.ok||data.status==='error')throw Error(data.message||'No pudimos preparar la partida.');
   if(data.status==='ready'){
    setGame(createGame(data));setConfig(data.config);setLoaded({});setView('play');
   }else setProblem(data);
  }catch(e){setProblem({status:'error',message:'No pudimos preparar la partida. Tu progreso y tus filtros se conservan. Intentá de nuevo en un momento.'});}
  finally{setBusy(false);inFlight.current=false;}
 }
 function closeProblem(){setView('settings');setProblem(null);requestAnimationFrame(()=>startButtonRef.current?.focus({preventScroll:true}))}
 function requestMatch(settings=config){if(active)setPending(settings);else startMatch(settings)}
 function handleFailure(id){setGame(previous=>replaceFailedPoster(previous,id));setLoaded(previous=>({...previous,[id]:false}))}
 function handleReady(id){setLoaded(previous=>previous[id]?previous:{...previous,[id]:true})}
 function pick(id){setLoaded({});setRetry(n=>n+1);setGame(previous=>choose(previous,id))}
 function rewind(){setLoaded({});setRetry(n=>n+1);setGame(previous=>undo(previous))}
 function backHome(){setView('home');setProblem(null);setLoaded({})}
 const playable=game?.pair.every(m=>loaded[m.id])&&!game.blocked;
 return <main className={view==='settings'?'customizing':undefined}>
  <header><button className="brand" aria-label="Movie Duel — Ir al inicio" onClick={backHome}>MOVIE<span>DUEL</span><b aria-hidden="true">✦</b></button><span className="header-note">EL CINE SE ELIGE</span></header>
  {!hydrated?<section className="waiting" role="status">Preparando tu cine…</section>:<>
   <span className="sr-only" role="status">{busy?'PREPARANDO PARTIDA…':''}</span>
   {storageError&&<p className="notice" role="status">Este navegador no permite guardar el progreso. Mantené esta página abierta para conservar la partida.</p>}
   {view==='home'&&<section className="intro">
    <h1 ref={titleRef} tabIndex={-1}>¿Cuál será tu favorita?</h1>
    <p className="description">Elegí entre dos películas. Tu favorita sigue en juego hasta encontrar a la campeona.</p>
    <fieldset className="quick-duels"><legend>Duelos</legend>{[10,20,40].map(count=><button key={count} aria-pressed={config.duels===count} onClick={()=>update('duels',count)}>{count}</button>)}</fieldset>
    <div className="home-actions">{active&&<button className="primary" onClick={()=>setView('play')}>CONTINUAR PARTIDA</button>}<button className={active?'secondary':'primary'} disabled={busy} onClick={()=>requestMatch()}>{busy?'PREPARANDO PARTIDA…':'JUGAR AHORA'}</button><button className="secondary" disabled={busy} onClick={()=>{setView('settings');setProblem(null)}}>PERSONALIZAR PARTIDA</button></div>
   </section>}
   {view==='settings'&&<section className="settings">
    <button className="text-button" onClick={backHome}>← INICIO</button><h1 ref={titleRef} tabIndex={-1}>Personalizar partida</h1>
    <div className="form-grid"><div className="field"><label htmlFor="genre">Género</label><select id="genre" value={config.genre} onChange={e=>update('genre',e.target.value)}><option value="">Todos</option>{GENRES.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
     <div className="field"><label htmlFor="decade">Década</label><select id="decade" value={config.decade} onChange={e=>update('decade',e.target.value)}><option value="">Todas</option>{DECADES.map(d=><option key={d} value={d}>{d}–{Number(d)+9}</option>)}</select></div>
     <div className="field duels-control"><label htmlFor="duels">Duelos <strong>{config.duels}</strong></label><div className="slider-row"><button className="step" aria-label="Menos duelos" disabled={config.duels<=5} onClick={()=>update('duels',config.duels-1)}>−</button><input id="duels" type="range" min="5" max="40" value={config.duels} onChange={e=>update('duels',Number(e.target.value))}/><button className="step" aria-label="Más duelos" disabled={config.duels>=40} onClick={()=>update('duels',config.duels+1)}>+</button></div><div className="range-values"><span>5 duelos</span><span>40 duelos</span></div></div>
     <fieldset className="field difficulty"><legend>Dificultad</legend><div className="segmented">{[['normal','Normal'],['expert','Experto']].map(([id,label])=><button key={id} aria-pressed={config.difficulty===id} onClick={()=>update('difficulty',id)}>{label}</button>)}</div><p>{config.difficulty==='normal'?'Historias reconocibles y representativas.':'Cine de autor, internacional y de culto. Menos conocido, no menos valioso.'}</p></fieldset>
    </div>
    <details className="advanced"><summary>Opciones avanzadas <span>{advanced?`${advanced} ${advanced===1?'filtro activo':'filtros activos'}`:'Sin filtros'}</span><b aria-hidden="true">+</b></summary><div className="advanced-fields">
     <Picker label="Actor, actriz o director" value={config.people} multiple remote disabled={config.people.length>=5} onChange={people=>update('people',people)} placeholder="Buscar por nombre"/>
     <p className="field-hint">Hasta cinco personas. Mezclaremos sus filmografías.</p>
     <Picker label="País de origen o producción" options={options.countries} value={config.country} onChange={country=>update('country',country)} placeholder="Todos los países"/>
     <Picker label="Idioma original" options={options.languages} value={config.language} onChange={language=>update('language',language)} placeholder="Todos los idiomas"/>
     <p className="field-hint">El idioma original puede ser distinto del país de producción.</p>
    </div></details>
    {options.source==='catalog'&&<p className="catalog-note">Selección de {options.catalogSize||230} películas de TMDB. La búsqueda de personas y sus filmografías se limita a este catálogo.</p>}
    {optionsError&&<p className="notice" role="alert">No pudimos cargar los países e idiomas. Recargá la página para volver a intentarlo; tu configuración se conserva.</p>}
    <button className="text-button reset" disabled={busy} onClick={()=>{setConfig({...DEFAULT_CONFIG});setProblem(null)}}>RESTABLECER CONFIGURACIÓN</button>
    <div className="sticky-start"><button ref={startButtonRef} className="primary" aria-busy={busy} disabled={busy} onClick={()=>requestMatch()}>{busy?'PREPARANDO PARTIDA…':'EMPEZAR PARTIDA'}</button></div>
   </section>}
   {view==='play'&&game&&(finished?<section className="result">
    <p className="trophy" aria-hidden="true">♛</p><h1 ref={titleRef} tabIndex={-1}>¡TENEMOS CAMPEONA!</h1><p className="champion-subtitle">Tu película favorita de esta partida</p>
    <div className="winner-poster"><Poster key={`${game.pair[0].id}-${retry}`} movie={game.pair[0]} onReady={handleReady} onFail={handleFailure} retry={retry}/></div>
    <h2>{game.pair[0].title}</h2><p className="winner-detail">{game.pair[0].year} <span>·</span> {game.history.length} duelos completados</p>
    <div className="actions"><button className="primary" disabled={busy} onClick={()=>requestMatch(game.config)}>{busy?'PREPARANDO…':'JUGAR OTRA VEZ'}</button><button className="secondary" disabled={busy} onClick={()=>{setConfig(game.config);setView('settings');setProblem(null)}}>NUEVA PARTIDA</button></div>
    <button className="text-button" onClick={rewind}>↶ DESHACER</button>
   </section>:<section className="arena">
    <div className="round-info"><span className="eyebrow" aria-live="polite">DUELO {String(game.history.length+1).padStart(2,'0')} / {game.config.duels}</span><button className="text-button" onClick={backHome}>← INICIO</button></div>
    <div className="progress" role="progressbar" aria-label="Progreso de la partida" aria-valuetext={`Duelo ${game.history.length+1} de ${game.config.duels}`} aria-valuenow={game.history.length+1} aria-valuemin={0} aria-valuemax={game.config.duels}><div style={{width:`${(game.history.length+1)/game.config.duels*100}%`}}/></div>
    <h1 className="arena-title" ref={titleRef} tabIndex={-1}>¿Cuál se queda?</h1>
    <div className="duel">{game.pair.map((movie,index)=><article className="movie" key={index}>
     {game.history.length>0&&<p className="movie-label">{index===0?'SELECCIÓN ACTUAL':'NUEVA PELÍCULA'}</p>}
     <button className="poster-button" disabled={!playable} aria-label={`Elegir ${movie.title}`} onClick={()=>pick(movie.id)}><Poster key={`${movie.id}-${retry}`} movie={movie} onReady={handleReady} onFail={handleFailure} retry={retry}/></button>
     <div className="movie-info"><h2 title={movie.title}>{movie.title}</h2><p>{movie.year}</p></div>
     <button className="choose" disabled={!playable} aria-label={`Elegir ${movie.title}, botón`} onClick={()=>pick(movie.id)}>ELEGIR</button>
    </article>)}</div>
    <div className="arena-bottom"><button className="secondary" disabled={!game.history.length} onClick={rewind}>↶ DESHACER</button></div>
   </section>)}
   {view==='play'&&game?.blocked&&<div className="problem" role="alert"><h2>No pudimos cargar un afiche</h2><p>No se descontó ningún duelo. Podés volver a intentar o modificar los filtros para preparar otra selección.</p><div className="actions"><button className="secondary" onClick={()=>{setLoaded({});setRetry(n=>n+1);setGame(previous=>({...previous,failedIds:[],blocked:false}))}}>REINTENTAR AFICHES</button><button className="secondary" onClick={()=>{setConfig(game.config);setView('settings')}}>MODIFICAR FILTROS</button></div></div>}
   {problem&&<MatchProblem problem={problem} busy={busy} onShorter={()=>startMatch({...config,duels:problem.available})} onModify={closeProblem} onRetry={()=>startMatch(config)}/>}
   {pending&&<Confirm onCancel={()=>{setPending(null);if(game)setView('play')}} onConfirm={()=>{const settings=pending;setPending(null);startMatch(settings)}}/>}
  </>}
  <footer>{view!=='play'&&<span>Hecho para quienes aman el cine.</span>}<p>Afiches y datos de <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a>. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.</p></footer>
 </main>
}
