import {prepareMatch} from '../../../lib/tmdb.mjs';
export async function POST(request){
 try {
  const text=await request.text();
  if(text.length>5000) return Response.json({status:'error',message:'La configuración no es válida.'},{status:400});
  return Response.json(await prepareMatch(JSON.parse(text)),{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({status:'error',message:'No pudimos preparar la partida. Revisá la configuración e intentá de nuevo.'},{status:400})}
}
