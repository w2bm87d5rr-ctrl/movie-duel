// TMDB IDs and original poster paths. Scores define the curated challenge order.
export const movies = [
[19995,'Avatar',2009,7.6,'jRXYjXNq0Cs2TcJjLkki24MLp7u.jpg'],
[329,'Jurassic Park',1993,8.2,'oU7Oq2kFAAlGqbU4VoAE36g4hoI.jpg'],
[24428,'Los Vengadores',2012,7.7,'RYMX2wcKCBAr24UyPD7xwmjaTn.jpg'],
[120467,'El gran hotel Budapest',2014,8.1,'eWdyYQreja6JGCzqHWXpWHDrrPo.jpg'],
[98,'Gladiador',2000,8.2,'ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg'],
[600,'La chaqueta metálica',1987,8.3,'kMKyx1k8hWWscYFnPbnxxN4Eqo4.jpg'],
[105,'Volver al futuro',1985,8.3,'fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg'],
[38,'Eterno resplandor de una mente sin recuerdos',2004,8.3,'5MwkWH9tYHv3mV9OdYTMR5qreIz.jpg'],
[299534,'Avengers: Endgame',2019,8.3,'or06FN3Dka5tukK1e9sl16pB3iy.jpg'],
[11,'Star Wars',1977,8.2,'6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg'],
[13,'Forrest Gump',1994,8.5,'arw2vcBveWOVZr6pxd9XTd1TdQa.jpg'],
[157336,'Interestelar',2014,8.5,'gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'],
[27205,'El origen',2010,8.4,'oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg'],
[603,'Matrix',1999,8.2,'f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'],
[550,'El club de la pelea',1999,8.4,'pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg'],
[129,'El viaje de Chihiro',2001,8.5,'39wmItIWsg5sZMyRUHLkWBcuVCM.jpg'],
[496243,'Parásitos',2019,8.5,'7IiTTgloJzvGI1TAYymCfbfl3vT.jpg'],
[680,'Pulp Fiction',1994,8.5,'d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg'],
[155,'Batman: el caballero de la noche',2008,8.5,'qJ2tW6WMUDux911r6m7haRef0WH.jpg'],
[122,'El señor de los anillos: el retorno del rey',2003,8.5,'rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg'],
[238,'El padrino',1972,8.7,'3bhkrj58Vtu7enYsRolD1fZdja1.jpg'],
].map(([id,title,year,score,poster])=>({id,title,year,score,poster:`https://image.tmdb.org/t/p/w500/${poster}`}));
export async function getMovies() {
 const token = process.env.TMDB_READ_ACCESS_TOKEN;
 if (!token) return movies;
 return Promise.all(movies.map(async movie => {
  try {
   const response = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?language=es-AR`, {headers:{Authorization:`Bearer ${token}`},next:{revalidate:86400},signal:AbortSignal.timeout(5000)});
   if (!response.ok) return movie;
   const data = await response.json();
   return {...movie,title:data.title || movie.title,poster:data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : movie.poster};
  } catch { return movie; }
 }));
}
