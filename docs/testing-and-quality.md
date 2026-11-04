# Pruebas y calidad

La estrategia está definida en `ludoteca_virtual_adr_004_calidad_pruebas.md`.

## Variables para pruebas

El `.env` raíz debe contener una URL explícita para la base de pruebas:

```dotenv
TEST_DATABASE_URL=postgresql://ludoteca_app:CHANGE_ME_LOCAL@localhost:5433/ludoteca_test
```

La configuración de Vitest para la API rechaza cualquier base cuyo nombre no
termine en `_test`. No deriva esta URL desde `DATABASE_URL` y no permite usar
silenciosamente `ludoteca_dev`.

## Comandos raíz

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:e2e
npm run test:coverage
npm run build
```

Para aplicar formato:

```bash
npm run format
```

En PowerShell puede utilizarse `npm.cmd` si la política local bloquea
`npm.ps1`.

## Alcance actual

- `packages/contracts`: schemas Zod válidos e inválidos.
- `apps/api`: configuración, health checks, errores, request IDs, redacción de
  logs e integración PostgreSQL.
- `apps/web`: configuración pública, cliente HTTP, health check, registro,
  login, sesión, logout y edición de perfil.
- `e2e`: recorrido real de identidad y perfil entre Chromium, Next.js, Express
  y PostgreSQL.

Playwright se incorporó en E01-ST08 al existir el primer flujo funcional. Su
runner usa exclusivamente `ludoteca_test`, compila la aplicación, levanta los
dos servicios de forma aislada y garantiza su cierre al finalizar.

La primera instalación de navegador se prepara con:

```powershell
npx.cmd playwright install chromium
```

## Cobertura

Cada workspace conserva su reporte bajo su propio directorio `coverage/`,
ignorado por Git. Los umbrales iniciales son deliberadamente alcanzables y
deben crecer junto con el dominio.

Los entrypoints operativos (`server.ts`, runners de seeds y preparación de la
base de pruebas) se excluyen del porcentaje unitario. Su comportamiento se
valida mediante build, ejecución de migraciones, idempotencia de seeds y
pruebas de integración PostgreSQL; no se consideran cubiertos artificialmente
por importarlos.

## Paquetes compartidos de pruebas

`packages/test-utils` no se crea todavía porque no existe una utilidad real
consumida por más de un workspace. Se añadirá únicamente cuando aparezca ese
consumidor, conforme a ADR-002.
