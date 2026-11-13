# Interfaz web del catálogo

E03-ST07 incorpora el catálogo en <http://localhost:3000/catalogo> y el detalle
en `/catalogo/:gameId`. Ambas pantallas consumen exclusivamente la API HTTP
documentada; el navegador no accede a PostgreSQL.

## Listado y búsqueda

- La entrada `Buscar juegos` consulta por nombre.
- Los filtros permiten combinar nombre, mecánica, categoría y el rango
  registrado de jugadores. Al completar ambos límites la coincidencia es
  exacta: 1–4 no incluye juegos 2–4. Con un solo valor se busca una cantidad
  admitida: un juego 2–8 coincide con 4, pero no con 1.
- El orden permite nombre, creación más reciente o año de publicación.
- La navegación conserva páginas de 12 resultados y muestra estados de carga,
  resultado vacío y error recuperable.
- Una persona anónima ve el catálogo público aprobado. Una sesión autenticada
  ve además sus juegos privados, identificados como `Privado · Tuyo`.
- Las tarjetas y la ficha muestran la portada administrada o un estado vacío
  claro. El propietario puede subir la portada de su juego privado y un
  moderador puede corregirla antes de aprobarlo. Después de la aprobación,
  `CONTENT_MANAGER` y `ADMIN` pueden reemplazarla desde la ficha pública.
- El formulario de juego privado acepta una portada opcional JPG, PNG o WebP de
  hasta 8 MB. El archivo se valida antes de crear la ficha y se carga
  inmediatamente después; si esa segunda operación falla, el juego permanece
  creado y se ofrece acceso directo a su detalle para reintentar sin duplicarlo.

La acción `Crear juego privado` usa `POST /api/v1/games`. Requiere una sesión,
permiso `game.create` y token CSRF. Desde la ficha privada, su propietario puede
usar `Proponer como global`, añadir una nota opcional y enviar el mismo juego a
moderación. Mientras está pendiente, continúa siendo privado y sus copias no se
alteran.

## Juego y edición

Cada tarjeta del catálogo usa la acción `Ver ficha`. La ficha es consultable
sin que el juego pertenezca a una ludoteca y presenta descripción, jugadores,
año, duración, edad, complejidad, mecánicas y los datos disponibles de sus
ediciones.

Un usuario autenticado puede registrar desde allí una copia física. Primero
elige una de estas referencias:

- juego general: `{ gameId, editionId: null }`;
- edición concreta: `{ gameId, editionId }`.

Después selecciona una ludoteca activa en la que sea `OWNER` o `MANAGER`, el
estado de la copia y metadatos opcionales. La confirmación usa
`POST /api/v1/collections/:collectionId/copies`, crea la copia y su historial y
ofrece un enlace directo a la ludoteca. Una visita anónima conserva acceso a la
ficha, pero recibe una invitación clara a iniciar sesión; si no hay ludotecas
editables, se enlaza a su creación o administración.

La API vuelve a comprobar la visibilidad del juego, que la edición pertenezca a
ese juego y el rol del usuario. No se confía en identificadores enviados por el
cliente.

## Administración del catálogo público

Una sesión `CONTENT_MANAGER` o `ADMIN` encuentra la acción `Editar ficha
pública` dentro del detalle de cada juego aprobado. El formulario permite
corregir nombre, descripción, año, jugadores, duración, edades, complejidad y
mecánicas y categorías. También habilita la carga o reemplazo de la portada. Los cambios se
publican inmediatamente y quedan registrados en auditoría.

Los usuarios normales no ven estas acciones. Un `MODERATOR` puede preparar o
corregir una portada mientras el juego está pendiente, pero no modificar la
ficha una vez incorporada al catálogo.

## Contratos y pruebas

El módulo web `src/lib/api/games.ts` valida respuestas y solicitudes mediante
los contratos Zod compartidos. Las pruebas de componentes cubren búsqueda,
mecánicas, rangos de jugadores, orden, paginación, estados, creación con
portada, recuperación ante fallo de carga, consulta pública, selección de
edición y registro directo en una ludoteca. El escenario Playwright registra
una cuenta contra PostgreSQL de pruebas y recorre creación privada y selección
del juego.

Las APIs relacionadas están documentadas en:

- [Listado de juegos](api/game-list.md)
- [Detalle y ediciones](api/game-detail.md)
- [Creación privada](api/game-create-private.md)
- [Administración de fichas públicas](api/game-update-public.md)
- [Moderación de juegos](api/game-moderation.md)
