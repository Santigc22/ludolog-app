# Evidencia integral del vertical de copias

E04-ST08 demuestra el recorrido `usuario → ludoteca → juego → copia →
movimiento/salida` mediante contratos, integración real con PostgreSQL,
componentes web y Chromium contra el build de producción.

## Matriz de escenarios

| Escenario exigido | Evidencia automatizada | Resultado protegido |
|---|---|---|
| Crear usuario y ludoteca, elegir juego y registrar copia | `identity-flow.spec.ts` | Copia física `ACTIVE` creada desde la UI |
| Rechazar edición de otro juego | `copy-create.test.ts` | `400 GAME_EDITION_NOT_FOUND`; no se persiste la copia |
| Mover A → B conservando identidad e historial | `identity-flow.spec.ts`, `copy-move.test.ts` | Mismo UUID, dos tramos continuos y uno abierto |
| Impedir destino no autorizado | `copy-move.test.ts` | Destino oculto o rol insuficiente rechazado |
| Retirar una copia vendida externamente sin comprador | `copy-exit.test.ts` | `SOLD` no exige usuario comprador ni tablas de venta |
| Mantener `DAMAGED + ACTIVE` y retirar después por daño | `identity-flow.spec.ts`, `copy-exit.test.ts` | Condición y lifecycle permanecen separados |
| Revertir si falla auditoría | `copy-create.test.ts`, `copy-move.test.ts`, `copy-exit.test.ts` | Copia, ubicación, lifecycle e historial vuelven al estado previo |
| Resolver dos movimientos concurrentes | `copy-move.test.ts` | Una confirmación, un conflicto y exactamente un tramo abierto |
| Resolver dos salidas concurrentes | `copy-exit.test.ts` | Una sola transición y una sola auditoría |
| Ocultar cambios directos de ubicación/lifecycle | `contracts.test.ts`, `copy-update.test.ts` | Los contratos estrictos rechazan campos de dominio |

## Recorrido Playwright

El segundo escenario de `identity-flow.spec.ts` realiza estas acciones desde el
navegador:

1. registra una cuenta;
2. crea ludotecas de origen y destino;
3. crea y selecciona un juego visible;
4. registra una copia `DAMAGED`, comprobando que sigue `ACTIVE`;
5. captura la respuesta HTTP para conservar el UUID como evidencia;
6. mueve la misma copia y verifica dos tramos con uno abierto;
7. abre la ludoteca destino y retira la copia por daño;
8. verifica el mismo UUID, `EXITED`, ubicación nula y todos los tramos cerrados.

Playwright ejecuta Chromium contra `next start` y la API compilada. Antes de la
suite, `db:test:setup` reconstruye `ludoteca_test`, aplica migraciones, carga
datos estructurales y verifica las restricciones.

Los archivos de integración de la API se ejecutan en serie porque comparten
esa base y algunos instalan temporalmente triggers que fuerzan fallos de
auditoría. Esto evita interbloqueos de DDL entre archivos sin desactivar la
concurrencia que cada prueba abre explícitamente para validar movimientos y
salidas simultáneos.

## Comandos reproducibles

```powershell
npm.cmd run test:coverage
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

`test:e2e` requiere `TEST_DATABASE_URL` en `.env`; el script inicia y detiene
automáticamente API y web. Al cerrar la historia pasan 2 recorridos Chromium y
173 pruebas Vitest distribuidas entre API, web y contratos.
