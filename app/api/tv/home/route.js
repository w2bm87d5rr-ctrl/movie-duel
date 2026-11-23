import {tmdb} from '../../../../lib/tmdb-server.js';
export async function GET(){
 try{
  const items=await Promise.all([1396,1398].map(id=>tmdb('tv/'+id)));
  return Response.json({posters:items.filter(m=>m.poster_path).map(m=>({id:m.id,title:m.name,poster:'https://image.tmdb.org/t/p/w500'+m.poster_path}))},{headers:{'Cache-Control':'private,max-age=3600'}});
 }catch{return Response.json({posters:[]})}
}
