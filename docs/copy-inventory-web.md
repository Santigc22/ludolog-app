# Interfaz web del inventario de copias

Cada copia muestra la portada del juego cuando existe, tanto en la cuadrícula
de la ludoteca como en el encabezado de su detalle. La ausencia de portada se
representa con un estado vacío y no impide administrar la copia.

Las tarjetas usan siempre el nombre del juego asociado como título principal.
Un alias se presenta como dato secundario con la etiqueta
`Alias:`. Todo alias guardado permanece visible, incluso si coincide con el
nombre del juego. Condición, estado, jugadores, edición, mecánicas y categorías
se agrupan visualmente en bloques separados.

E04-ST07 incorpora el inventario físico dentro del detalle de cada ludoteca en
`http://localhost:3000/ludotecas/:collectionId`. La pantalla consume únicamente
la API HTTP y usa los contratos Zod compartidos para validar solicitudes y
respuestas.

## Registro y consulta

- El formulario carga los juegos visibles para la sesión.
- Después de elegir un juego consulta su detalle y ofrece exclusivamente sus
  ediciones; cambiar de juego limpia la selección anterior.
- El usuario puede seleccionar una edición existente o activar `Proponer una
  nueva edición`. En ese modo informa como mínimo el nombre y, opcionalmente,
  número o versión, idioma, año, ISBN, SKU, UPC y notas.
- Al registrar una propuesta, la copia se crea de inmediato con esa edición y
  la interfaz confirma que quedó pendiente de moderación. Solo el autor puede
  reutilizarla mientras está pendiente; una vez aprobada queda disponible para
  todos.
- Permite registrar condición, alias y notas sin exponer lifecycle ni ubicación
  como campos editables. La ayuda del alias aclara que identifica el ejemplar y
  no cambia el juego seleccionado.
- El inventario muestra copias activas e históricas. Al seleccionar una se
  consulta su detalle, edición, condición, historial y adquisiciones.
- En `Editar copia` puede asignarse otra edición existente, volver a `Sin
  edición específica` o proponer una nueva. La copia conserva su identificador,
  historial y adquisiciones; una propuesta queda vinculada inmediatamente y
  pasa a la cola de moderación.

## Operaciones de dominio

Las acciones de escritura solo se muestran cuando la API informa capacidad de
edición y la ludoteca está activa:

- editar cambia alias, notas y condición; la ayuda aclara que `DAMAGED` no
  significa retirada;
- mover exige seleccionar una ludoteca activa donde el usuario sea `OWNER` o
  `MANAGER` y confirmar el destino por nombre;
- retirar exige una causa y una confirmación que explica que la copia saldrá de
  la ludoteca, pero conservará historial y adquisiciones.

Express conserva la decisión final de autorización. Los filtros del cliente
mejoran la experiencia, pero no sustituyen permisos, membresías ni roles.
Un único valor de jugadores busca juegos que admitan esa cantidad; con ambos
valores se exige el rango registrado exacto, igual que en el catálogo.

## Conflictos concurrentes

Si editar, mover o retirar responde `409`, la interfaz vuelve a consultar el
detalle y el listado. Así reemplaza el estado obsoleto por el confirmado por la
API y avisa que otra operación modificó la copia.

## Código y pruebas

- `src/lib/api/copies.ts` implementa el cliente HTTP tipado y añade CSRF a las
  escrituras.
- `src/components/copies/copy-inventory-workspace.tsx` contiene los estados y
  flujos interactivos.
- `copy-inventory-workspace.test.tsx` cubre listado, detalle, juego, selección
  de edición, propuesta de una edición nueva, movimiento confirmado,
  explicación y confirmación de retirada, y recuperación de conflictos.
- `api-modules.test.ts` comprueba rutas, serialización y CSRF del módulo.

Las APIs consumidas se documentan en [docs/api/README.md](./api/README.md).
