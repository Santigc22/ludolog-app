# Matriz de pruebas de ownership y visibilidad

E02-ST07 consolida la evidencia automatizada de que RBAC global, membresía,
rol interno, visibilidad y estado son controles independientes.

| Escenario | Evidencia | Resultado |
|---|---|---|
| `OWNER` con `collection.update` edita | `collection-update.test.ts` | `200`; cambios persistidos |
| Permiso global sin membresía | `collection-update.test.ts` | Se confirma el permiso y responde `404` |
| `VIEWER` intenta editar | `collection-update.test.ts` | `403 COLLECTION_ROLE_DENIED` |
| Externo consulta privada | `collection-detail.test.ts` | `404 COLLECTION_NOT_FOUND` |
| Archivar conserva registros | `collection-update.test.ts` | Ludoteca y tres membresías permanecen |
| Operación inválida conserva propietario | `collection-update.test.ts` | Un `OWNER`; metadatos sin alteración |
| Listado no filtra recursos ajenos | `collection-list.test.ts` | Solo membresías del usuario |
| Flujo real de navegador | `identity-flow.spec.ts` | Crear, editar y archivar pasa en Chromium |

## Comandos

`npm.cmd test` y `npm.cmd run test:e2e` pasan. La cobertura obtenida es:

| Workspace | Líneas | Ramas | Funciones | Estado del umbral |
|---|---:|---:|---:|---|
| API | 91.19% | 83.41% | 92.30% | Cumple |
| Contratos | 100% | 100% | 100% | Cumple |
| Web | 97.66% | 86.81% | 95.23% | Cumple |

`npm.cmd run test:coverage` termina correctamente en los tres workspaces. Los
umbrales no se redujeron y no se excluyó código para ocultar la brecha: se
agregaron pruebas de registro, sesión, validaciones, paginación, archivado,
lectura pública y errores recuperables. E02-ST07 queda `DONE`.
