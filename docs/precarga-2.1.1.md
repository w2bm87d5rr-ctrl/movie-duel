# Movie Duel 2.1.1: un único próximo contrincante

Base exacta: `fa751df464532e85c0c9f413fba99feb2e27cd89`. Rama: `perf/poster-preloading-2-1-1`. Sin despliegues ni cambios en Vercel.

## Diagnóstico

`choose()` agrega una elección al historial y utiliza `deck[history.length + 1]` con la longitud ya incrementada. Antes de elegir entre A y B, el próximo contrincante es por tanto `deck[game.history.length + 2]`: C. No depende de qué película gane. El último duelo no tiene próximo contrincante y la campeona tampoco.

La versión 2.1 consultaba metadatos del mazo completo y las reservas, pero descargaba los afiches al montar cada película visible. `pick()` reiniciaba el estado de carga e incrementaba `retry`; las claves por posición desmontaban la ganadora incluso cuando sólo debía cambiar de columna. La caché de descargas mitigaba parte del costo, pero C no se precargaba y la ganadora se recreaba.

## Implementación

- `nextOpponent()` identifica una sola película futura, sin cambiar el mazo ni llamar a selección.
- Los objetivos de localización son únicamente las dos películas visibles y ese próximo contrincante. La Home consulta sólo sus dos decoraciones; personalización no inicia consultas de películas. La campeona consulta sólo su película.
- Cada ID utiliza la caché de presentación existente y una solicitud pendiente compartida: pasar C de futura a visible no vuelve a solicitar sus metadatos. Las solicitudes que salen de la ventana se cancelan; se ignoran respuestas obsoletas. No se exploran reservas ni historial para precargar.
- `NextPoster` no genera DOM visible: resuelve y precarga una única imagen de C con el mismo mecanismo de afiches estables. Mientras faltan metadatos no descarga preventivamente su afiche base. El fallback se utiliza sólo si hace falta.
- Una caché de decisiones por partida conserva el afiche ya resuelto. Sigue utilizándose la caché global de descargas (128 entradas, cinco minutos) de 2.1. La caché por partida se reinicia al comenzar otra partida y no se escribe dentro de sus objetos.
- Las películas se identifican por ID en React. Elegir no incrementa `retry` ni desmonta la ganadora: incluso si estaba a la derecha, su nodo pasa a la izquierda con la misma imagen. Se conserva su indicador de carga; el nuevo contrincante informa su propia disponibilidad.
- Se mantienen la prioridad AR → MX → LATAM → original, las imágenes verificadas, el plazo de metadatos de 1,2 segundos y el plazo de descarga de 2,5 segundos por imagen. La preparación del próximo duelo nunca se espera desde `choose()`.

## Límites y compatibilidad

Los IDs, deck, reservas, historial, orden, ganadores, configuración y formato `movie-duel:v2` permanecen intactos. No se modifican la lógica de selección, dificultades, filtros ni endpoints TMDB. No se agregan dependencias ni servicios.

Si se elige muy rápido o la red falla, el siguiente duelo puede mostrar el placeholder 2:3 hasta que la imagen o su fallback estén listos. La elección ya quedó registrada y la navegación sigue disponible. Una vez mostrado un afiche no cambia por metadatos tardíos. La localización de títulos conserva el comportamiento progresivo de 2.1.

Deshacer puede reutilizar películas ya descargadas y recargar una imagen si el navegador la expulsó de su caché. Una descarga de imagen que se inició cuando una película era elegible puede terminar después de deshacer o navegar; no se programa otro duelo futuro desde ella. Los metadatos fuera de la ventana sí se abortan. No existe una cadena que precargue D después de C: D se inicia sólo al entrar al siguiente duelo. No se inicia trabajo futuro en el último duelo, con partida bloqueada o en campeona.

La ventana secuencial supone solicitudes pequeñas de metadatos por película en vez de lotes del mazo completo. Esto evita localizar reservas y futuros innecesarios, a costa de más solicitudes HTTP pequeñas a lo largo de una partida completada. La caché y la concurrencia existente del servidor siguen aplicándose.

## Validación

- `npm test`: 60 aprobadas, cero fallos. Normal y Experto, 5/20/40 duelos; siguiente ID exacto, ausencia de futuro al final, igualdad del mazo, deshacer y guardado/continuación.
- `npm run build`: aprobado (Next.js 15.5.29). Sin cambios de dependencias.
- `tests/sequential-preload.cjs`: Chromium y WebKit Linux. Durante A/B sólo A, B y C tienen descargas; C sólo descarga su afiche elegido. No se solicita D hasta elegir. Ganadora conserva nodo DOM y título, sin nueva descarga. No hay doble consulta de C cuando pasa de futura a visible. Incluye deshacer, continuación, campeona y elección rápida con metadatos de C retrasados tres segundos.
- Pruebas existentes: e2e (incluido Experto y filtros), localización, estabilidad de afiches, Home, filtros por país/personas, modales/progreso/campeona y foco móvil en WebKit. Sin errores de JavaScript detectados.

### Mediciones controladas

Se comparó el build Production de 2.1 con el build local de esta rama usando el mismo mazo y un simulador de caché HTTP. Latencia: 180 ms para metadatos, 300 ms por primera descarga de imagen y 700 ms de decisión. Se midió desde el clic hasta que se habilitan ambos botones del nuevo duelo.

| Navegador local | 2.1 | 2.1.1 |
| --- | --- | --- |
| Chromium, muestras | 345–359 ms | 83–162 ms |
| WebKit Linux, muestras | 573 ms | 71–74 ms |

Son muestras de laboratorio sensibles a carga y automatización; no son medianas estadísticas, pruebas de red TMDB real ni resultados de Safari físico. La prueba de elección rápida registra la elección antes de terminar la precarga y permite el fallback; en las muestras, la imagen pendiente quedó disponible aproximadamente 1,3 segundos después del clic.

## Preview propuesta, pendiente de autorización

1. Respaldar exclusivamente esta rama/commit en GitHub, sin tocar main ni las ramas aprobadas.
2. Crear una Preview del commit final en `movie-duel-postcss-security-test`, usando su variable Preview existente, sin copiar secretos ni cambiar configuraciones.
3. Validar TMDB real, trazas de red A/B→C→D, ganadora sin recarga y decisión rápida desde Safari en iPhone.
4. Mantener intactos el proyecto original y el despliegue público `dpl_FWFt4p9mJ3o7FLNE9vqEvhooEhWJ`.

Esta tarea no crea despliegues ni publica la rama remota.
