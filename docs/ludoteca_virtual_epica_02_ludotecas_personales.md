# Ludoteca Virtual — E02: Ludotecas personales

**Estado de la épica:** `DONE`  
**Dependencias:** E00 y E01  
**Resultado esperado:** un usuario administra ludotecas personales con ownership y visibilidad consistentes.

## 1. Alcance

Esta épica implementa solamente ludotecas personales. Las ludotecas de grupo, invitaciones y membresías grupales pertenecen a E05.

`is_for_sale` no se expone todavía: activar una ludoteca de venta exige crear borradores de publicación según R-COL-07, comportamiento que corresponde a E07. Hasta entonces, la API debe rechazar o ignorar de forma explícitamente documentada cualquier intento de activarlo; no debe persistir un estado parcialmente soportado.

## 2. Reglas trazadas

| Regla | Aplicación |
|---|---|
| R-COL-01 | Una ludoteca tiene responsable identificable |
| R-COL-02 | Una ludoteca personal pertenece a uno o más miembros con roles definidos |
| R-COL-03 | Debe conservar al menos un propietario |
| R-COL-04 | Visibilidad no concede modificación |
| R-COL-05 | Los permisos combinan RBAC y relación con el recurso |
| R-COL-06 | Archivar no destruye el historial |
| R-COL-07 | Diferida a E07; no se activa parcialmente |

## 3. Features e historias

| Historia | Feature | Depende de | Estado |
|---|---|---|---|
| E02-ST01 | Esquema de ludotecas y membresía | E00-ST07, E01-ST02 | `DONE` |
| E02-ST02 | Crear ludoteca personal | ST01, E01-ST07 | `DONE` |
| E02-ST03 | Listar ludotecas accesibles | ST01, E01-ST05 | `DONE` |
| E02-ST04 | Consultar detalle | ST01, ST03 | `DONE` |
| E02-ST05 | Editar y archivar | ST02, ST04 | `DONE` |
| E02-ST06 | Interfaz de ludotecas | ST02–ST05 | `DONE` |
| E02-ST07 | Pruebas de ownership y visibilidad | ST02–ST06 | `DONE` |

## 4. Historias detalladas

### E02-ST01 — Crear esquema de ludotecas y membresía

**Objetivo:** persistir ludotecas personales, roles internos y acceso por membresía.

**Alcance:** catálogos necesarios, `collections`, `collection_members`, mapeo Drizzle, migración e índices.

**Criterios de aceptación:**

1. Una ludoteca distingue tipo, estado y visibilidad.
2. La membresía vincula usuario, ludoteca y rol interno.
3. Duplicar la misma membresía está impedido por base de datos.
4. El modelo permite varios miembros en el futuro sin afirmar que el grupo ya está implementado.
5. Se documenta que la invariantes “al menos un OWNER” se protege en servicio/transacción.

### E02-ST02 — Crear una ludoteca personal

**Objetivo:** permitir que un usuario autenticado cree una ludoteca y se convierta en su propietario.

**Criterios de aceptación:**

1. La entrada se valida mediante contrato compartido.
2. Ludoteca y membresía `OWNER` se crean atómicamente.
3. El creador es el responsable inicial y puede consultarla inmediatamente.
4. `is_for_sale=true` no es aceptado en esta fase.
5. Fallar al crear la membresía revierte la ludoteca.

### E02-ST03 — Listar ludotecas accesibles

**Objetivo:** mostrar al usuario autenticado las ludotecas de las que es miembro.

**Criterios de aceptación:**

1. La consulta no devuelve ludotecas privadas ajenas.
2. La respuesta identifica el rol efectivo del usuario.
3. Se soporta paginación estable si el baseline de API ya la definió.
4. Las ludotecas archivadas se excluyen por defecto y pueden solicitarse con un filtro explícito autorizado.

### E02-ST04 — Consultar una ludoteca

**Objetivo:** obtener metadatos de una ludoteca aplicando visibilidad y membresía.

**Criterios de aceptación:**

1. El servicio distingue lectura pública/autorizada de capacidad de edición.
2. Una ludoteca privada ajena no filtra metadatos sensibles.
3. La respuesta no incluye datos internos de autorización innecesarios.
4. Los errores `404`/`403` siguen la política general de no filtración acordada.

### E02-ST05 — Editar y archivar una ludoteca

**Objetivo:** permitir cambios de metadatos y archivado solo a miembros autorizados.

**Criterios de aceptación:**

1. Se exige el permiso RBAC correspondiente y rol suficiente sobre esa ludoteca.
2. Visibilidad no se interpreta como permiso de edición.
3. Archivar conserva ludoteca, membresías y futuros históricos de copias.
4. Ninguna operación puede dejar la ludoteca sin `OWNER`.
5. No se implementa borrado físico.

### E02-ST06 — Crear interfaz de ludotecas personales

**Objetivo:** listar, crear, ver y editar ludotecas desde Next.js.

**Criterios de aceptación:**

1. La UI refleja permisos recibidos/calculados por la API y maneja rechazos del servidor.
2. Crear y editar presentan errores de validación por campo.
3. El estado vacío ofrece una acción clara para crear la primera ludoteca.
4. No se muestra opción de ludoteca de venta ni de grupo.

### E02-ST07 — Probar ownership y visibilidad

**Objetivo:** demostrar que el acceso no depende únicamente del rol global.

**Escenarios mínimos:**

- propietario con `collection.update` puede editar;
- usuario con permiso global pero sin relación no puede editar una ludoteca privada;
- lector no puede editar;
- usuario externo no ve una ludoteca privada;
- archivar no elimina registros;
- una operación inválida no deja cero propietarios.

**Criterio de aceptación:** los escenarios existen como pruebas automatizadas en el nivel apropiado y pasan desde los comandos raíz.

## 5. Límites para el agente

- No implementar grupos, invitaciones, shares, copias o ventas en esta épica.
- No autorizar desde componentes de UI; Express conserva la decisión final.
- No activar `is_for_sale` hasta E07.
- No modificar reglas R-COL sin registrar primero la decisión en el documento de dominio.

## 6. Cierre de la épica

E02 está `DONE` cuando el flujo local permite crear, listar, consultar, editar y archivar una ludoteca personal, con pruebas que demuestran la combinación de RBAC, membership y visibilidad.
