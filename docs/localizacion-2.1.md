# Localización argentina y latinoamericana (2.1)

Base: 38e2f15de6e1b5c9848d6eff7cddcebc89c91630. Sin cambios de selección, filtros, dependencias ni despliegues.

## Títulos y procedencia

Se consultan detalles de cada película con `append_to_response=translations,alternative_titles,images`, sin imponer idioma al listado de imágenes. Sólo se leen `original_title`, `original_language`, traducciones españolas por país, títulos alternativos por país e imágenes. Los nombres de personas no cambian.

Prioridad: AR, MX, UY, CL, CO, PE, EC, BO, PY, VE, CR, PA, GT, SV, HN, NI, DO, CU; finalmente `original_title`. Dentro de cada país se prefiere una traducción explícita única y luego un título alternativo único. Se descartan títulos marcados como informales, de trabajo o no oficiales. Los casos ambiguos pasan al siguiente país. ES nunca es un fallback. Los metadatos son aportes de TMDB, no una certificación legal de título oficial; un registro sin país/idioma suficiente no permite inferir un título regional.

`lib/localization-seed.json` es una instantánea de las páginas públicas en inglés de TMDB para los 230 IDs del catálogo y los ejemplos de prueba, consultadas el 18/11/2026. Conserva títulos originales para arrancar sin red. Los cuatro ejemplos incluyen datos regionales reales de `/titles` y `/translations`:

| ID | Original | Regional elegido | Evidencia |
| --- | --- | --- | --- |
| 771 | Home Alone | Mi pobre angelito | traducción es-MX |
| 562 | Die Hard | Duro de matar | traducción es-MX; alternativa MX: Duro de Matar |
| 165 | Back to the Future Part II | Volver al Futuro II | título alternativo AR; prevalece sobre traducción MX |
| 600 | Full Metal Jacket | Nacido para matar | título alternativo AR; prevalece sobre Cara de guerra, MX |

Fuentes: `https://www.themoviedb.org/movie/{ID}/titles` y `/translations`. Cada entrada conserva su URL de origen. Estas comprobaciones públicas no sustituyen una prueba autenticada de la API en una futura Preview.

## Afiches

TMDB informa el idioma de cada imagen, pero no su país. Por eso un afiche `es` no se considera argentino o mexicano automáticamente. `lib/localization-exceptions.mjs` contiene únicamente rutas revisadas visualmente cuyo texto coincide con el título regional. La primera excepción es 165, afiche «Volver al Futuro II»: el país indica compatibilidad de título, no el origen físico de la impresión.

La API prioriza esas rutas si siguen presentes y tienen como mínimo 500×750 píxeles y proporción compatible. Después busca imágenes etiquetadas en el idioma original. Una etiqueta de idioma nula no demuestra que el afiche carezca de texto, así que tampoco se utiliza como prueba de una alternativa segura. No se utiliza un afiche español no verificado como nueva alternativa localizada. Si falta información o falla la descarga se conserva el afiche base existente, sin cambiar de película. Esto implica que una partida antigua puede conservar temporalmente su afiche previo, incluso si TMDB no permite identificar su mercado. La instantánea offline sólo conserva referencias de afiches revisadas en la tabla de excepciones; no aplica los pósters predeterminados de páginas traducidas como prueba de procedencia regional.

Los afiches se resuelven una sola vez por montaje/duelo. Mientras falta la localización, el marco 2:3 muestra un placeholder y se precarga el afiche base sin mostrarlo. Se esperan hasta 1,2 segundos por los metadatos; si están disponibles en caché, no se espera ese plazo. La imagen elegida se precarga con un máximo de 2,5 segundos por descarga. Si falla la localizada se utiliza la base, ya precargada cuando fue posible. Una vez visible, el afiche queda fijo aunque lleguen nuevos metadatos. Se mantiene una caché en memoria de hasta 128 descargas durante cinco minutos; los fallos se eliminan. Home y partidas usan el mismo mecanismo. No se retrasa la petición de partida ni la navegación; la elección sigue esperando únicamente a que estén disponibles los afiches, como antes. El manejo previo de fallos del afiche base se conserva.

## Rendimiento, persistencia y seguridad

La consulta `/api/presentation` es exclusivamente del servidor y reutiliza el acceso TMDB existente. Nunca devuelve credenciales. Acepta hasta 12 IDs positivos por solicitud y cuerpos pequeños. Hay cuatro consultas simultáneas como máximo por instancia, caché de hasta 512 resultados durante 24 horas y deduplicación de peticiones concurrentes. El presupuesto por lote es 4,5 segundos; cada consulta tiene un máximo de 2,5 segundos incluyendo reintentos. La caché es por instancia, no distribuida.

El navegador trabaja por lotes secuenciales, con seis segundos de máximo por lote. No espera esta tarea para iniciar o continuar. La caché de presentación se guarda aparte, expira y se valida al recuperar. Los fallos no muestran errores de selección ni vuelven a sortear. Se reintentan al recargar; no hay un bucle de reintentos automáticos. Un mazo grande puede tardar varios lotes en completar la presentación.

Se mantiene `movie-duel:v2` y el formato de los objetos del juego. La propiedad opcional `presentation` es independiente: `deck`, `pair`, reservas, historial, ganadores y configuración no se reescriben. Las partidas antiguas del catálogo tienen un título original disponible en la instantánea. Un ID remoto de una partida anterior sin `originalTitle` conserva temporalmente su título guardado hasta conseguir metadatos: no es posible deducir con seguridad su mercado sin TMDB.

## Validación y Preview pendiente

Pruebas puras de prioridad, España, ambigüedad, calidad de afiches y sanitización; invariantes y continuación de 40 duelos; proveedor simulado de 53 películas, concurrencia, caché y timeout. Navegador con respuestas pendientes y afiches localizados fallidos: inicio inmediato, actualización progresiva, accesibilidad, persistencia, deshacer y campeona; tamaños móviles y escritorio.

Las pruebas locales no usan el secreto ni consultan la API autenticada real. La prueba posterior propuesta es una Preview en `movie-duel-postcss-security-test`, desde el commit final de esta rama, usando sólo la variable Preview ya existente. Requiere autorización posterior. Safari real en iPhone y la cobertura autenticada de títulos/afiches quedan para esa revisión. No se modifica la versión pública.

### Resultado local final

- `npm ci`: completado sin cambios en package.json/package-lock.json.
- `npm test`: 52 aprobadas, cero fallos.
- `npm run build`: aprobado con Next.js 15.5.29.
- `tests/localization.cjs`: aprobado en Chromium y WebKit Linux; tamaños 320, 375, 390, 430 y 1440.
- `tests/home.cjs`: aprobado con imágenes reales, siete tamaños y controles de 20 Normal/5 Experto/continuación.
- `tests/e2e.cjs`, `tests/ux.cjs`, `tests/country-filters.cjs`: aprobados; filtros, modales, persistencia, historial, selección y campeona.
- `tests/iphone-focus.cjs`: aprobado en WebKit Linux, conservando inputs 16 px y zoom manual.
- Endpoint real local: 200 con referencias públicas, 400 para IDs inválidos. El bundle estático no contiene `TMDB_READ_ACCESS_TOKEN` ni la URL de la API autenticada.
- Pendientes: API de TMDB con credencial en Preview aislada y Safari real en iPhone. Ningún despliegue realizado.

Corrección de afiches estables: `tests/stable-poster.cjs` aprobado en Chromium y WebKit Linux. Incluye placeholder inicial, recuperación de caché guardada, navegación rápida, deshacer y timeout con metadatos tardíos sin sustitución visible. Se ajustó la prueba de afiche irrecuperable para simular un fallo persistente: un único error transitorio de precarga puede recuperarse antes de mostrar la imagen.
