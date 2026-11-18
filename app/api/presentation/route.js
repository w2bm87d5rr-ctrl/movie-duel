import 'server-only';
import {getPresentations,LOCALIZATION_BATCH_LIMIT} from '../../../lib/localization-server.mjs';
export async function POST(request){
 try{
  const text=await request.text();if(text.length>1024)return Response.json({presentation:{}},{status:400});
  const {ids}=JSON.parse(text);
  if(!Array.isArray(ids)||ids.length>LOCALIZATION_BATCH_LIMIT||!ids.every(id=>Number.isSafeInteger(id)&&id>0))return Response.json({presentation:{}},{status:400});
  return Response.json({presentation:await getPresentations(ids)},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({presentation:{}},{headers:{'Cache-Control':'private, no-store'}})}
}
