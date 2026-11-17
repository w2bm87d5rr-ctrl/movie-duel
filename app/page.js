import {getMovies} from '../lib/movies.mjs';
import Game from './game';
export default async function Page(){return <Game movies={await getMovies()}/>}
