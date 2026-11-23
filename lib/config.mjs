export const DEFAULT_CONFIG = {genre:'',decade:'',duels:20,difficulty:'normal',people:[],country:'',language:''};
export const GENRES = [{id:'28',name:'Acción'},{id:'12',name:'Aventura'},{id:'16',name:'Animación'},{id:'35',name:'Comedia'},{id:'80',name:'Crimen'},{id:'18',name:'Drama'},{id:'10751',name:'Familia'},{id:'14',name:'Fantasía'},{id:'36',name:'Historia'},{id:'27',name:'Terror'},{id:'10402',name:'Música'},{id:'9648',name:'Misterio'},{id:'10749',name:'Romance'},{id:'878',name:'Ciencia ficción'},{id:'10770',name:'Película de TV'},{id:'53',name:'Suspenso'},{id:'10752',name:'Bélica'},{id:'37',name:'Western'}];
export const TV_GENRES=[{id:'10759',name:'Acción y aventura'},{id:'16',name:'Animación'},{id:'35',name:'Comedia'},{id:'80',name:'Crimen'},{id:'18',name:'Drama'},{id:'10751',name:'Familia'},{id:'10762',name:'Infantil'},{id:'9648',name:'Misterio'},{id:'10765',name:'Ciencia ficción y fantasía'},{id:'10768',name:'Bélica y política'},{id:'37',name:'Western'}];
export const DECADES = Array.from({length:14},(_,i)=>String(2020-i*10));
export function normalizeConfig(input={},mode='movie') {
 const value=input && typeof input==='object' ? input : {};
 return {
  genre:(mode==='tv'?TV_GENRES:GENRES).some(g=>g.id===String(value.genre)) ? String(value.genre) : '',
  decade:DECADES.includes(String(value.decade)) ? String(value.decade) : '',
  duels:Math.min(40,Math.max(5,Math.round(Number(value.duels)||20))),
  difficulty:value.difficulty==='expert' ? 'expert' : 'normal',
  people:Array.isArray(value.people) ? [...new Map(value.people.filter(p=>Number.isSafeInteger(p?.id)&&p.id>0&&typeof p.name==='string').map(p=>[p.id,{id:p.id,name:p.name.slice(0,120)}])).values()].slice(0,5) : [],
  country:typeof value.country==='string' && /^[A-Z]{2}$/.test(value.country) ? value.country : '',
  language:typeof value.language==='string' && /^[a-z]{2}$/.test(value.language) ? value.language : '',
 };
}
export function localizedOptions(codes,type) {
 const names=new Intl.DisplayNames(['es'],{type,fallback:'none'});
 return [...new Set(codes)].filter(Boolean).map(id=>({id,name:({SU:'Unión Soviética',XC:'Checoslovaquia',XW:'Alemania Occidental',xx:'Sin diálogo'}[id])||names.of(id)})).filter(x=>x.name && x.name!==x.id).sort((a,b)=>a.name.localeCompare(b.name,'es'));
}

// Validate before normalization: never silently drop an incompatible person.
export function configIssue(input={}) {
 const people=Array.isArray(input?.people)?new Set(input.people.filter(p=>Number.isSafeInteger(p?.id)&&p.id>0&&typeof p.name==='string').map(p=>p.id)):new Set();
 if(input?.country&&people.size>1)return 'Para filtrar por país, dejá seleccionada una sola persona. Quitá el país para seleccionar hasta cinco. Tus filtros se conservaron.';
 if(people.size>5)return 'Podés seleccionar hasta cinco personas sin país. Tus filtros se conservaron.';
 return '';
}
