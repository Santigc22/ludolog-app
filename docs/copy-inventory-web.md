# Interfaz web del inventario de copias

E04-ST07 incorpora el inventario físico dentro del detalle de cada ludoteca en
`http://localhost:3000/ludotecas/:collectionId`. La pantalla consume únicamente
la API HTTP y usa los contratos Zod compartidos para validar solicitudes y
respuestas.

## Registro y consulta

- El formulario carga los juegos visibles para la sesión.
- Después de elegir un juego consulta su detalle y ofrece exclusivamente sus
  ediciones; cambiar de juego limpia la selección anterior.
- Permite registrar condición, alias y notas sin exponer lifecycle ni ubicación
  como campos editables.
- El inventario muestra copias activas e históricas. Al seleccionar una se
  consulta su detalle, edición, condición, historial y adquisiciones.

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

## Conflictos concurrentes

Si editar, mover o retirar responde `409`, la interfaz vuelve a consultar el
detalle y el listado. Así reemplaza el estado obsoleto por el confirmado por la
API y avisa que otra operación modificó la copia.

## Código y pruebas

- `src/lib/api/copies.ts` implementa el cliente HTTP tipado y añade CSRF a las
  escrituras.
- `src/components/copies/copy-inventory-workspace.tsx` contiene los estados y
  flujos interactivos.
- `copy-inventory-workspace.test.tsx` cubre listado, detalle, juego y edición,
  movimiento confirmado, explicación y confirmación de retirada, y
  recuperación de conflictos.
- `api-modules.test.ts` comprueba rutas, serialización y CSRF del módulo.

Las APIs consumidas se documentan en [docs/api/README.md](./api/README.md).
