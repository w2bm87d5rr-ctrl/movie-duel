import {searchPeople} from '../../../lib/tmdb.mjs';
export async function GET(request){
 const query=new URL(request.url).searchParams.get('q')||'';
 try{return Response.json({people:await searchPeople(query.slice(0,100))},{headers:{'Cache-Control':'private, max-age=300'}})}
 catch{return Response.json({error:'No pudimos buscar personas. Intentá de nuevo.'},{status:503})}
}
