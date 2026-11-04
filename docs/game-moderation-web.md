# Interfaz web de moderación

El propietario de una ficha privada puede abrirla desde `/catalogo/:gameId` y
usar `Proponer como global`. La interfaz acepta una nota opcional, informa el
estado pendiente y permite un nuevo envío cuando una propuesta fue rechazada.

Las cuentas con rol `MODERATOR` o `ADMIN` usan `/moderacion`. La pantalla ofrece
colas separadas para pendientes, aprobados y rechazados. Cada tarjeta muestra
datos del juego, rango de jugadores, mecánicas, autor y nota de propuesta.

En casos pendientes, el moderador puede:

- aprobar la ficha como juego global comunitario, con confirmación;
- rechazarla indicando un motivo obligatorio.

Un usuario sin permisos recibe un estado de acceso restringido. La interfaz
consume exclusivamente la API HTTP y valida sus respuestas con los contratos
compartidos. `moderation-workspace.test.tsx` cubre carga, aprobación, rechazo y
acceso denegado; `game-workspaces.test.tsx` cubre el envío del propietario.
