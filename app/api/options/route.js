import {getOptions} from '../../../lib/tmdb.mjs';
export async function GET(){return Response.json(await getOptions(),{headers:{'Cache-Control':'public, max-age=300'}})}
