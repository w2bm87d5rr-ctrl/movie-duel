import {getOptions} from '../../../lib/tmdb-server.js';
export async function GET(request){
 try{return Response.json(await getOptions(new URL(request.url).searchParams.get('mode')==='tv'?'tv':'movie'),{headers:{'Cache-Control':'private, no-store'}})}
 catch(error){return Response.json({source:'error',error:'No pudimos verificar el acceso a TMDB.',code:error.code||'TMDB_UPSTREAM_ERROR'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
