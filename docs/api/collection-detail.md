# Consultar una ludoteca

## `GET /api/v1/collections/:collectionId`

Devuelve los metadatos de una ludoteca según su visibilidad, estado y relación
con el usuario actual. Requiere un `Origin` igual a `WEB_ORIGIN`, pero admite
lectura anónima de recursos públicos activos.

El parámetro `collectionId` debe ser un UUID y se valida mediante
`CollectionIdParamsSchema`.

## Política de lectura

| Solicitante | Recurso | Resultado |
|---|---|---|
| Miembro | Activo o archivado | `200` con su rol efectivo |
| Externo o anónimo | `PUBLIC` y `ACTIVE` | `200`, sin rol ni edición |
| Externo o anónimo | `PRIVATE` | `404 COLLECTION_NOT_FOUND` |
| Externo o anónimo | Archivado | `404 COLLECTION_NOT_FOUND` |

Una cookie de sesión presente pero inválida no se trata como anónima: responde
`401`. Así se evita ocultar problemas de sesión al cliente.

## Respuesta `200`

El contrato fuente es `CollectionDetailResponseSchema` y la respuesta incluye
`Cache-Control: no-store`:

```json
{
  "collection": {
    "id": "4e145b05-1f8c-4b3f-a535-3c474bb55e95",
    "type": "PERSONAL",
    "status": "ACTIVE",
    "name": "Mi colección",
    "description": null,
    "visibility": "PRIVATE",
    "isForSale": false,
    "createdByUserId": "3297a863-b2f0-4746-bfec-e76517342f86",
    "effectiveRole": "OWNER",
    "canEdit": true,
    "createdAt": "2026-09-21T22:30:00.000Z",
    "updatedAt": "2026-09-21T22:30:00.000Z",
    "archivedAt": null
  }
}
```

`effectiveRole` es `null` para una lectura externa. `canEdit` solo es `true`
cuando coinciden un rol interno `OWNER` o `MANAGER` y el permiso global
`collection.update`. Este valor ayuda a representar la interfaz, pero Express
volverá a autorizar cualquier futura escritura.

La respuesta no expone permisos globales, roles globales ni datos internos de
sesión.

## Errores

| Estado | Código | Motivo |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | `collectionId` no es un UUID válido |
| `401` | `SESSION_INVALID` | Se envió una sesión desconocida, revocada o inactiva |
| `401` | `SESSION_EXPIRED` | La sesión enviada venció |
| `403` | `ORIGIN_NOT_ALLOWED` | Origen distinto de `WEB_ORIGIN` |
| `404` | `COLLECTION_NOT_FOUND` | No existe o el solicitante no puede conocerla |

El mismo `404` cubre inexistencia, privacidad y archivado ajeno para evitar
filtrar la existencia del recurso.

## Pruebas automatizadas

Las pruebas cubren lectura pública anónima, propietario editable, lector sin
edición, acceso de miembros a archivadas, ocultamiento de privadas/archivadas
ajenas, UUID inválido y cookie inválida.
