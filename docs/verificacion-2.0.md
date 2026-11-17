# Verificación de Movie Duel 2.0

## Versión revisable

- Rama local: `feat/movie-duel-2-preview`.
- Commit de implementación desplegado: `ef05c90b2eaed65e93e535d848bc8d323fb7e21a`.
- Preview: https://movie-duel-372g1z5ic-w2bm87d5rr-ctrl.vercel.app
- Despliegue: `dpl_5yqQpMFKZxqFZUW1tmvjhaSkTB5Q`, estado READY.
- Entorno: Preview; Vercel usa `target: staging` en su API (el valor literal `preview` fue rechazado sin crear un despliegue).
- Producción se conserva en `dpl_8Pr3Q6BfTiSMLgcqoExFZy7rweSx`. Se verificó la asignación de ambos dominios productivos.

## Resultados

- `npm test`: 24 pruebas aprobadas. Incluyen 5/10/20/40 duelos en ambas dificultades; filtros individuales y combinados; OR de personas; ampliación ordenada de preferencias; insuficiencia y ausencia de resultados; deduplicación; afiches; deshacer y restauración de progreso.
- Proveedor remoto probado con respuestas simuladas: paginación, créditos de actuación/dirección, país de producción, autocompletado, errores, cuotas y caché.
- `npm run build`: aprobado. Next.js ejecutó sus verificaciones integradas; el proyecto no tiene configuración separada de TypeScript ni ESLint.
- `npm run test:e2e`: aprobado en el build local de producción. Chromium a 320/375/390/430/768/1440 píxeles: dos afiches en paralelo; personalización; personas; país/idioma; deshacer múltiple; recarga/continuación; confirmar/cancelar sustitución; campeona/reinicio; restablecer; ausencia de resultados sin perder la partida anterior; alternativa de 34 duelos por insuficiencia; sustitución de un afiche fallido sin consumir un duelo. Sin errores JavaScript ni desbordamiento horizontal.
- URLs de los 230 afiches: HTTP 200 mediante solicitudes HEAD. Inspección visual adicional con afiches reales en personalización, duelo y campeona a 390 píxeles.
- Preview: GET autenticado de `/`, `/api/options` y `/api/people?q=bunuel`, todos HTTP 200. Catálogo correcto de 230 películas, nombres de países/idiomas localizados y persona con fotografía.
- Registros de errores/fatal de la Preview: sin entradas encontradas durante la comprobación. Esto no constituye monitorización continua.

## Límites

No se configuró un token de TMDB, conforme a la preferencia del usuario. La Preview usa el catálogo de respaldo; búsquedas y filmografías no son exhaustivas. La integración autenticada se probó mediante simulación, no con una credencial real. La prueba de navegador completa se ejecutó localmente; la Preview se comprobó mediante las herramientas autenticadas de Vercel. La protección de acceso de Vercel permanece activa.

El guardado es local al navegador. Las reservas de afiches son finitas y, si se agotan, se ofrece reintentar o modificar filtros sin consumir duelos.

## Publicar más adelante

Solo después de aprobación expresa: revisar las variables productivas, generar un despliegue de producción con el código aprobado, verificarlo y asignar los dominios existentes. No se promovió ni publicó la versión 2.0 en producción.
