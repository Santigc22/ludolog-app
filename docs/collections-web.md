# Interfaz web de ludotecas personales

E02-ST06 incorpora el flujo web de ludotecas consumiendo exclusivamente la API
Express documentada. Next.js no consulta PostgreSQL ni decide permisos por su
cuenta.

## Rutas

| Ruta | Acceso | Función |
|---|---|---|
| `/ludotecas` | Sesión requerida | Listar, filtrar archivadas y crear ludotecas |
| `/ludotecas/[collectionId]` | Según API | Consultar, editar y archivar |

La navegación principal enlaza a `/ludotecas`.

## Listado y creación

El listado presenta visibilidad, estado y el total de juegos activos ubicados
actualmente en cada ludoteca. Soporta paginación y el filtro «Mostrar
archivadas». Cuando no hay resultados ofrece directamente la creación de la
primera ludoteca.

El formulario de creación solo muestra nombre, descripción y visibilidad. No
ofrece grupo, venta, estado ni roles. Los errores de validación de la API se
asocian a sus campos cuando están disponibles.

## Detalle, edición y archivado

La página dinámica recibe `params` como promesa, según Next.js 16, y entrega el
identificador a un componente cliente interactivo.

- `canEdit` controla si se representa el formulario o una vista de solo
  lectura;
- solo un `OWNER` activo ve la acción de archivar;
- estas decisiones son de presentación: Express vuelve a comprobar RBAC,
  membresía, estado y CSRF en cada escritura;
- el archivado solicita confirmación y explica que conserva el historial;
- una ludoteca archivada pasa inmediatamente a modo de solo lectura.
- el inventario permite filtrar por nombre, mecánica, rango de jugadores y
  estado actual o histórico de la copia.

## Pruebas

Las pruebas de componentes cubren estado vacío, creación, sesión ausente,
edición y archivado según capacidades. El E2E de Chromium recorre registro,
perfil, creación, edición y archivado de una ludoteca, y cierre de sesión:

```powershell
npm.cmd run test:e2e
```
