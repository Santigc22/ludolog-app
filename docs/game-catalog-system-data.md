# Catálogos estructurales de Game

E03-ST01 reutiliza tres catálogos creados por la migración base y mantenidos
por los `system seeds` idempotentes:

| Catálogo | Códigos requeridos por E03 |
|---|---|
| `game_classifications` | `OFFICIAL`, `COMMUNITY`, `PRIVATE` |
| `moderation_statuses` | `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `REJECTED_DUPLICATE`, `BLOCKED`, `ARCHIVED` |
| `visibility_levels` | `PRIVATE`, `PUBLIC` |

`visibility_levels` también contiene `GROUP` porque es un catálogo compartido
por toda la plataforma. Sin embargo, E03 no implementa todavía un grupo que
pueda actuar como scope de Game. Por ello la política inicial es:

- un juego privado usa clasificación `PRIVATE`, moderación `DRAFT`, visibilidad
  `PRIVATE` y requiere propietario;
- un juego del catálogo público usa clasificación `OFFICIAL` o `COMMUNITY`,
  moderación `APPROVED` y visibilidad `PUBLIC`;
- `GROUP` se rechaza para Game en esta fase. E03-ST02 debe materializar esta
  decisión mediante constraints de base de datos.

Estos seeds no contienen juegos ni ediciones. Los pocos títulos de ejemplo
pertenecen al seed de desarrollo de E03-ST03 y nunca al seed estructural.

## Verificación

```powershell
npm.cmd run db:seed
npm.cmd run db:test:setup -w @ludoteca/api
npm.cmd test -w @ludoteca/api
```

La preparación de la base de pruebas ejecuta dos veces los system seeds para
comprobar idempotencia y valida la presencia de todos los códigos requeridos.
