# Movie Duel 2.0 🎬

Next.js 15 + React 19. Interfaz en español y diseñada primero para iPhone. La versión 2 se desarrolla en `feat/movie-duel-2-preview`; **solo Preview, sin promover a producción**. El despliegue 1.0 del commit `24609a8` se conserva.

## Funcionalidad

- Partidas de 5 a 40 duelos; accesos rápidos de 10, 20 y 40.
- Género y década únicos, modos Normal y Experto.
- Hasta cinco actores/directores mediante OR; país e idioma original mediante AND.
- Deduplicación, mezcla entre partidas, reparto entre filmografías cuando hay títulos suficientes y reservas para errores de afiches.
- Ampliación primero de década y luego de género, conservando siempre los filtros avanzados.
- Ofrece menos duelos cuando hay entre 6 y los títulos solicitados; con menos de 6 pide modificar filtros.
- Afiches completos en proporción 2:3; no se pueden elegir hasta que ambos carguen.
- Deshacer múltiple con instantáneas exactas de los enfrentamientos, incluso desde la campeona.
- Inicio sin perder la partida, confirmación de reemplazo y guardado automático en el navegador.
- Configuración y partida se guardan por separado. Editar filtros no altera una partida ya iniciada.

## Datos de TMDB

Sin credenciales usa `lib/catalog.json` y `lib/people.json`: catálogo curado de películas, afiches y personas de TMDB. La búsqueda de personas y las filmografías disponibles **se limitan a ese catálogo**, indicado en personalización. Los títulos usan traducciones al español y, cuando no se dispone de ellas, su título original. Los afiches se descargan directamente del CDN de TMDB; no se incluyen imágenes en el repositorio.

Opcionalmente configurar `TMDB_READ_ACCESS_TOKEN` **solo para Preview** en Vercel habilita consultas del servidor a la API de TMDB. No pegar tokens en código ni en el chat. El navegador no recibe la credencial. El proveedor aplica caché de 24 horas y consultas acotadas: hasta 12 páginas de descubrimiento; créditos de hasta 5 personas; hasta 100 detalles cuando se debe verificar el país en una filmografía. No reintenta indefinidamente los errores de cuota. Las respuestas de partidas no se almacenan en caché; cada selección introduce variación.

En una caída de la API autenticada se muestra un error recuperable, conservando los filtros y la partida. No se sustituye silenciosamente una filmografía remota por una local incompleta.

## Desarrollo y verificaciones

Node.js 22 recomendado. Dependencias fijadas mediante `package-lock.json`.

```sh
npm ci
npm test
npm run build
npm start -- --port 3001
```

En otra sesión, con la app en el puerto 3001:

```sh
npm run test:e2e
```

El runner usa Chromium instalado en `/usr/bin/chromium`, `CHROMIUM_PATH` si se proporciona, o el navegador de Playwright. También acepta `MOVIE_DUEL_TEST_URL`. Las pruebas de interacción simulan imágenes para aislar la lógica de fallas de red; la disponibilidad de las URLs reales se verifica por separado. No hay una configuración adicional de TypeScript o ESLint: `next build` ejecuta sus verificaciones integradas.

## Persistencia y límites

`localStorage`, clave `movie-duel:v2`, conserva configuración y partida al recargar o cerrar. No sincroniza entre teléfonos/navegadores ni sobrevive a borrar los datos del sitio. Si el navegador deniega almacenamiento se muestra un aviso. Las reservas son finitas: si se agotan, se bloquea la elección y se ofrece reintentar afiches o modificar filtros sin descontar duelos. La campeona no se sustituye ante un fallo transitorio de su afiche.

## Preview y publicación

Crear un despliegue mediante archivos en el proyecto Vercel existente con `target: preview`; conservar los dominios, configuración de protección y despliegue de producción. La Preview puede solicitar iniciar sesión con la cuenta propietaria de Vercel.

Para producción, luego de aprobación expresa: verificar las variables del entorno productivo, generar un despliegue de producción con estos mismos archivos, comprobar el resultado y asignar los dominios existentes. Estos pasos **no se ejecutan** al preparar la Preview.

Afiches y datos pertenecen a sus titulares. Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.
