# Movie Duel 🎬

Juego web en español con Next.js y React, adaptable a celulares. Elegí tu película favorita en cada duelo: la ganadora continúa hasta coronarse campeona tras exactamente 20 elecciones.

## Juego

- 21 películas diferentes, con afiches reales alojados en TMDB.
- Rivales ordenados por puntuación editorial de referencia: los títulos más aclamados aparecen al final. La dificultad es subjetiva; no hay respuestas correctas ni puntaje del jugador.
- Deshacer recupera el duelo anterior, incluso desde la pantalla final.
- Volver a jugar reinicia la selección de 20 duelos.
- La partida vive en memoria; recargar la página la reinicia.
- Si un afiche no carga, se muestra el título y se puede seguir jugando.

## Ejecutar y verificar

Requiere Node.js 20 o posterior.

```sh
npm ci
npm run dev
npm test
npm run build
npm start
```

El repositorio incluye el archivo de bloqueo de dependencias para instalaciones reproducibles. `npm start` requiere compilar antes.

## TMDB y despliegue

Funciona sin credenciales con un catálogo curado de 21 películas y sus rutas reales de afiches. Opcionalmente, `TMDB_READ_ACCESS_TOKEN` permite obtener los títulos en español y afiches actuales desde TMDB en el servidor, con caché de 24 horas. Si TMDB falla, se conserva el catálogo inicial. Nunca se expone el token al navegador.

Para desplegar en Vercel, importá el repositorio y seleccioná Next.js; no requiere variables obligatorias. Para habilitar la actualización del catálogo, agregá el **API Read Access Token** de TMDB como variable de entorno `TMDB_READ_ACCESS_TOKEN` y volvé a desplegar. No subas tokens al repositorio.

Los afiches y datos pertenecen a sus titulares. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB. Revisá sus requisitos de atribución y uso antes de distribuir públicamente.
