# TMDB real — verificación de Preview

Fecha: 17 de noviembre de 2026.

- Preview final: https://movie-duel-im17udicd-w2bm87d5rr-ctrl.vercel.app
- Commit de código: `0e2911c2b73751c605686e587f588ca523062e0c`.
- Rama: `feat/movie-duel-2-tmdb-live`.
- Despliegue: `dpl_6p8RKTKHN4Ge1qEyVdXpv7AXTAdn`, READY, entorno Preview (`staging` en la API).

## Credencial y límites de servidor

Se utilizó la variable existente `TMDB_READ_ACCESS_TOKEN` de Preview. No se leyó, copió, imprimió ni solicitó su valor. Las solicitudes a TMDB usan Authorization únicamente en el servidor, detrás de un módulo marcado `server-only`. No se cambiaron variables de producción.

El modo TMDB se anuncia después de verificar realmente las consultas autenticadas de géneros, países e idiomas. Si esas consultas fallan se devuelve un error, sin sustituirlas silenciosamente por metadatos locales ni afirmar que la integración funciona. El catálogo de respaldo continúa disponible para entornos sin token, incluida la versión productiva anterior.

Las consultas usan caché, deduplicación y límites por solicitud. La selección ya no está limitada a las 230 películas locales. Se conserva la ampliación ordenada de década y género, manteniendo personas, país e idioma.

## Pruebas reales de API

Las solicitudes se hicieron contra funciones de Preview; el token de TMDB permaneció en Vercel. Se verificaron:

| Caso | Resultado |
| --- | --- |
| Géneros, países e idiomas | 18 géneros sin Documental, 249 países y 186 idiomas |
| Búsqueda de actor | Al Pacino, id 1158, profesión y fotografía |
| Búsqueda de director | Christopher Nolan, id 525, Dirección |
| Al Pacino, 20 duelos | 21 películas distintas; 19 fuera del catálogo local en la selección probada |
| Al Pacino + Drama + década de 1980 + Estados Unidos + inglés, 5 duelos | Partida lista; filtros avanzados respetados; 6 títulos fuera del catálogo local |
| Al Pacino O Robert De Niro + inglés, 10 duelos | Ambas filmografías representadas; sin duplicados |
| Sin filtros, 40 duelos | 41 películas, 30 fuera del catálogo local |
| Experto + Drama + Japón + japonés + década de 1960 | 20 duelos; 21 películas fuera del catálogo local |
| Al Pacino + Japón + japonés | Cero resultados; estado vacío correcto |
| Al Pacino + Reino Unido + inglés, solicitando 40 duelos | Oferta de 7 duelos |
| Aceptar los 7 duelos de Al Pacino | Partida lista con 8 películas distintas |

Los géneros/décadas pueden ampliarse conforme a la regla existente cuando faltan títulos. Personas, país e idioma permanecen estrictos. Las cantidades de TMDB son una observación de esta fecha y pueden cambiar.

Se comprobó la disponibilidad HTTP de 146 afiches únicos obtenidos en estos casos: todos respondieron 200.

## Navegador contra la Preview final

Se cargaron el HTML, JavaScript, CSS y API reales de la Preview mediante un cliente HTTPS autenticado para pruebas. La protección de acceso se mantuvo activa; no se deshabilitó la verificación TLS. El acceso temporal de prueba fue revocado al terminar. El navegador no recibió la credencial de TMDB.

En tamaño iPhone se probaron búsqueda de Al Pacino, ausencia del aviso de catálogo limitado, inicio de 20 duelos, elegir, deshacer, recarga/continuación, filtros Reino Unido/inglés, modal de oferta de 7 duelos, aceptación, recorrido de los siete duelos hasta la campeona y modal sin resultados al elegir japonés. Se conservaron los filtros al cerrar el modal.

Resultado: 12 imágenes reales cargadas sin fallos, cero errores JavaScript, sin desbordamiento horizontal y sin cabeceras Bearer ni variables privadas en las solicitudes del navegador. Se revisaron visualmente los modales, afiches y campeona; el diseño aprobado se conserva.

## Regresión y seguridad

- `npm test`: 27 pruebas aprobadas, incluidas nuevas comprobaciones de autenticación fallida, metadatos reales y respuestas de descubrimiento sin `origin_country`.
- `npm run build`: aprobado.
- `npm run test:e2e`: aprobado en build local; incluida la regresión que exige cerrar el autocompletado tras elegir un filtro.
- `npm run test:ux`: aprobado en build local; carga, errores, foco, modales, filtros, progreso y botones finales.
- Revisión de los 17 archivos JavaScript del bundle cliente: no contienen el nombre de la variable privada ni el endpoint autenticado de TMDB.
- Registros error/fatal de la Preview durante la comprobación: sin entradas encontradas.

El único ajuste adicional de interacción fue evitar que el autocompletado reabriera su lista al devolver foco al campo, lo que con los resultados completos podía tapar el botón de inicio. No se cambiaron CSS ni diseño, guardado, Deshacer o reglas de selección.

## Producción

El dominio principal `movie-duel-chi.vercel.app` se mantuvo en el despliegue original `dpl_8Pr3Q6BfTiSMLgcqoExFZy7rweSx`. La API de Vercel reasignó automáticamente el alias auxiliar `movie-duel-w2bm87d5rr-ctrl.vercel.app` a la Preview; se restauró expresamente al despliegue original y se verificó la asignación. No se creó ni promovió un despliegue de producción.
