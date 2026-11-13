# Interfaz web de moderación

El propietario de una ficha privada puede abrirla desde `/catalogo/:gameId` y
usar `Proponer como global`. La interfaz acepta una nota opcional, informa el
estado pendiente y permite un nuevo envío cuando una propuesta fue rechazada.

Las cuentas con rol `MODERATOR` o `ADMIN` usan `/moderacion`. La pantalla ofrece
colas separadas para pendientes, aprobados y rechazados. Cada tarjeta muestra
datos del juego, rango de jugadores, mecánicas, autor, nota de propuesta y, en
los casos resueltos, la persona responsable de la decisión. La cola de
aprobados permite filtrar por el usuario que aprobó cada juego.

La misma ruta presenta una segunda sección para ediciones propuestas. Sus
filtros de pendientes, aprobadas y rechazadas son independientes de la cola de
juegos. Cada registro muestra el juego relacionado, los metadatos de la
edición, su autor y la decisión tomada.

En casos pendientes, el moderador puede:

- aprobar la ficha como juego global comunitario, con confirmación;
- rechazarla indicando un motivo obligatorio.

Las ediciones pendientes ofrecen las mismas acciones. Aprobar una edición la
habilita en el selector de copias para toda la comunidad; rechazarla conserva
la referencia en la copia del autor y muestra allí su estado.

Un usuario sin permisos recibe un estado de acceso restringido. La interfaz
consume exclusivamente la API HTTP y valida sus respuestas con los contratos
compartidos. `moderation-workspace.test.tsx` cubre juegos y acceso denegado;
`edition-moderation-workspace.test.tsx` cubre aprobación y rechazo de
ediciones; `game-workspaces.test.tsx` cubre el envío del propietario.
