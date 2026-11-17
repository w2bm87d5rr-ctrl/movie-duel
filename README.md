# Movie Duel 🎬

Juego web de 20 duelos cinematográficos, con afiches obtenidos de TMDB y dificultad progresiva.

## Configuración

1. Registrate en https://www.themoviedb.org/ y solicitá acceso a su API.
2. Obtené el **API Read Access Token** (no la API Key v3).
3. En Vercel, agregá la variable de entorno `TMDB_READ_ACCESS_TOKEN` con el token como valor.
4. Importá este repositorio desde Vercel. Framework: Next.js.
5. Deploy.

Para desarrollo local: `npm install` y `npm run dev`.

**Seguridad:** nunca guardes el token en el repositorio. La consulta a TMDB se realiza desde el servidor.

Los afiches y datos pertenecen a sus titulares. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB. Revisá los requisitos de atribución y uso de TMDB antes de distribuir públicamente.
