# Ludoteca Virtual — E00: Fundación técnica

**Estado de la épica:** `DONE`  
**Prioridad:** crítica  
**Dependencias:** ninguna  
**Resultado esperado:** monorepo local ejecutable con `npm run dev`, contratos compartidos, API Express, aplicación Next.js, conexión PostgreSQL y bases de calidad.

## 1. Propósito

Crear una base técnica mínima y estable para que las siguientes épicas puedan desarrollarse sin redefinir estructura, comandos ni límites de responsabilidad.

Esta épica no implementa lógica funcional de la ludoteca.

## 2. Decisiones que gobiernan la épica

- Monorepo administrado con **npm workspaces**.
- TypeScript en aplicaciones y paquetes.
- `apps/api`: Express 5; dueño de reglas de negocio y acceso a datos.
- `apps/web`: Next.js con App Router; no accede directamente a PostgreSQL.
- `packages/contracts`: esquemas Zod 4, tipos y contratos compartidos.
- `apps/api/src/infrastructure/database`: Drizzle ORM, cliente `pg`, esquema y migraciones. La persistencia permanece interna a la API.
- `packages/config`: configuración compartida de herramientas cuando exista un consumidor real.
- PostgreSQL como base de datos.
- Arquitectura de API: `Route → Middleware → Controller → Service → Repository`.
- Desarrollo exclusivamente local durante esta fase.
- No se añade Turborepo mientras npm workspaces y scripts raíz sean suficientes.

Referencias: `ludoteca_virtual_arquitectura_aplicacion.md`, `ludoteca_virtual_adr_001_datos_validacion.md` y `ludoteca_virtual_adr_002_npm_workspaces.md`.

## 3. Features

| ID | Feature | Resultado |
|---|---|---|
| E00-F01 | Monorepo | Estructura y scripts raíz consistentes |
| E00-F02 | Contratos compartidos | Validación y tipos sin duplicación |
| E00-F03 | API base | Express inicia y expone health check |
| E00-F04 | Web base | Next.js inicia y consume configuración segura |
| E00-F05 | Datos locales | API conecta a PostgreSQL mediante Drizzle |
| E00-F06 | Operabilidad | Errores, request ID, logs y variables de entorno |
| E00-F07 | Calidad | Lint, typecheck y pruebas reproducibles |

## 4. Orden y estado inicial de historias

| Historia | Descripción | Depende de | Estado inicial |
|---|---|---|---|
| E00-ST01 | Crear esqueleto npm workspaces | — | `DONE` |
| E00-ST02 | Crear paquete de contratos | ST01 | `DONE` |
| E00-ST03 | Inicializar API Express | ST01 | `DONE` |
| E00-ST04 | Inicializar aplicación Next.js | ST01 | `DONE` |
| E00-ST05 | Configuración tipada de entorno | ST02, ST03, ST04 | `DONE` |
| E00-ST06 | Conectar Drizzle y PostgreSQL | ST03, ST05 | `DONE` |
| E00-ST07 | Flujo de migraciones y seeds | ST06, G04 | `DONE` |
| E00-ST08 | Errores, request ID y logs | ST03, ST05 | `DONE` |
| E00-ST09 | Base de pruebas y calidad | ST02–ST04, G02 | `DONE` |
| E00-ST10 | Documentar desarrollo local | ST05–ST09 | `DONE` |

Solo una historia cambia a `READY` cuando sus dependencias y gates estén resueltos explícitamente.

## 5. Historias

### E00-ST01 — Crear el esqueleto npm workspaces

**Objetivo:** disponer de la estructura raíz sin instalar todavía decisiones funcionales.

**Alcance:**

- Crear `package.json` raíz privado con workspaces `apps/*` y `packages/*`.
- Crear carpetas `apps/api`, `apps/web`, `packages/contracts` y `packages/config`.
- Reservar `packages/test-utils` para la historia de pruebas; no crear paquetes vacíos sin consumidor.
- Definir scripts raíz previstos: `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate` y `db:seed`.
- Crear una configuración TypeScript base compartida.
- Crear `.gitignore` y `.env.example` sin secretos.
- Añadir README raíz mínimo con el mapa de paquetes.

**Fuera de alcance:** implementar Express, Next.js, Drizzle, autenticación o instalar servicios de hosting.

**Rutas autorizadas:** raíz del repositorio, `apps/*` y `packages/*`, únicamente para archivos estructurales mínimos.

**Criterios de aceptación:**

1. `npm install` reconoce todos los workspaces y genera un único `package-lock.json` raíz.
2. Ningún workspace posee un lockfile independiente.
3. Los scripts raíz existen; pueden delegar en workspaces aún no implementados sin fingir que ya funcionan.
4. No hay credenciales ni valores secretos versionados.
5. La estructura coincide con el ADR de npm workspaces.

**Verificación mínima:** `npm ls --workspaces --depth=0`, revisión del árbol y validación JSON de `package.json`.

**Regla de parada:** detenerse si ya existe una estructura de proyecto incompatible o cambios no relacionados en `package.json`/`package-lock.json`.

### E00-ST02 — Crear `packages/contracts`

**Objetivo:** centralizar esquemas Zod y tipos que crucen el límite API/web.

**Alcance:**

- Configurar el paquete como workspace TypeScript.
- Definir convenciones para request, response, parámetros, filtros y errores públicos.
- Crear un contrato de ejemplo neutral, sin anticipar dominios no implementados.
- Exportar únicamente API pública desde el punto de entrada del paquete.

**Criterios de aceptación:**

1. API y web pueden importar el paquete por su nombre de workspace.
2. Los tipos se infieren desde los esquemas; no se duplican interfaces manuales equivalentes.
3. La compilación no depende de código interno de API o web.
4. Se incluye al menos una prueba de validación válida y una inválida.

**Regla de parada:** no definir contratos de autenticación antes de resolver `G01`.

### E00-ST03 — Inicializar la API Express

**Objetivo:** levantar una API mínima con separación entre construcción de aplicación y escucha de red.

**Alcance:**

- Configurar Express 5 y TypeScript.
- Crear `app` testeable y `server` como punto de arranque.
- Añadir prefijo `/api/v1`.
- Implementar `GET /api/v1/health` sin dependencia de base de datos.
- Preparar directorios transversales y de módulos sin generar archivos vacíos en masa.

**Criterios de aceptación:**

1. `npm run dev --workspace apps/api` inicia en el puerto configurado.
2. `GET /api/v1/health` responde `200` con un contrato estable.
3. Importar `app` en pruebas no abre un puerto.
4. No existe acceso a PostgreSQL ni lógica de negocio en controladores.

### E00-ST04 — Inicializar la aplicación Next.js

**Objetivo:** levantar una interfaz mínima con App Router y frontera clara con la API.

**Alcance:**

- Configurar Next.js y TypeScript en `apps/web`.
- Crear layout y página inicial mínima.
- Definir un cliente HTTP base para la API, sin lógica funcional.
- Separar variables públicas y privadas.

**Criterios de aceptación:**

1. `npm run dev --workspace apps/web` inicia localmente.
2. La página inicial carga sin errores de hidratación.
3. Ningún componente importa infraestructura de base de datos de `apps/api` ni usa `DATABASE_URL`.
4. La URL de API se obtiene de configuración validada.

### E00-ST05 — Configurar variables de entorno tipadas

**Objetivo:** fallar temprano y con mensajes claros ante configuración inválida.

**Alcance:**

- Validar configuración de API y web con esquemas Zod separados.
- Incluir como mínimo puertos, entorno, URL pública de API y `DATABASE_URL` donde corresponda.
- Mantener `.env.example` actualizado y sin valores sensibles.

**Criterios de aceptación:**

1. Una variable obligatoria ausente impide iniciar el proceso correspondiente.
2. El error identifica la variable inválida sin imprimir secretos.
3. Variables privadas del servidor no forman parte del bundle del navegador.

### E00-ST06 — Conectar Drizzle y PostgreSQL

**Objetivo:** disponer de una conexión controlada desde `apps/api/src/infrastructure/database`.

**Alcance:**

- Configurar `pg` y Drizzle como dependencias de `apps/api`.
- Exportar cliente y mecanismo explícito de cierre para pruebas/procesos.
- Añadir health check de base de datos separado del health check básico.
- No modelar aún tablas funcionales.

**Criterios de aceptación:**

1. La API conecta usando únicamente `DATABASE_URL` validada.
2. La web no puede importar el paquete de base de datos.
3. Un fallo de conexión produce un error controlado.
4. Las pruebas cierran el pool y no dejan procesos colgados.

**Gate resuelto:** `G03` adopta PostgreSQL 18 instalado directamente en
Windows, documentado en `ludoteca_virtual_guia_inicializacion_repo.md`.

### E00-ST07 — Establecer migraciones y seeds

**Objetivo:** hacer reproducible la creación y evolución del esquema.

**Alcance:**

- Configurar generación y ejecución de migraciones versionadas.
- Separar seeds `system`, `catalog` y `development`.
- Conectar las semillas estructurales existentes con un proceso idempotente.
- Documentar creación desde una base vacía.

**Criterios de aceptación:**

1. Una base vacía puede migrarse y sembrarse con comandos raíz.
2. Ejecutar de nuevo los seeds estructurales no duplica filas.
3. Los seeds de desarrollo requieren un comando explícito y no se ejecutan como parte del arranque normal.
4. No se usa `drizzle-kit push` como sustituto de migraciones compartidas.

**Gate resuelto:** `G04` se cerró mediante ADR-003. La implementación debe usar
UUID v4 generados por PostgreSQL y la estrategia `TIMESTAMPTZ(3)` allí definida.

### E00-ST08 — Añadir errores, request ID y logs

**Objetivo:** obtener respuestas de error y trazas consistentes sin filtrar datos sensibles.

**Alcance:** middleware de request ID, error de dominio base, manejador central, 404 y logger estructurado.

**Criterios de aceptación:**

1. Cada respuesta incluye o permite correlacionar un request ID.
2. Los errores públicos respetan el contrato compartido.
3. Los errores inesperados no exponen stack traces al cliente.
4. Contraseñas, tokens, cookies y cadenas de conexión se redactan en logs.

### E00-ST09 — Definir la base de pruebas y calidad

**Objetivo:** disponer de controles automáticos uniformes.

**Gate resuelto:** `G02` se cerró mediante ADR-004. La implementación debe
configurar Vitest, Testing Library, ESLint flat config y Prettier conforme a
esa decisión; Playwright permanece diferido hasta el primer flujo funcional.

**Alcance:** seleccionar y configurar herramientas de pruebas, lint y formato; añadir pruebas base para API, web y contratos.

**Criterios de aceptación:**

1. `npm run lint`, `npm run typecheck` y `npm test` funcionan desde la raíz.
2. Los fallos de cualquier workspace producen exit code distinto de cero.
3. Existe al menos una prueba de API sin puerto real y una prueba de contrato.
4. La elección queda registrada en `G02` o en un ADR derivado.

### E00-ST10 — Documentar el flujo local

**Objetivo:** permitir que una persona o agente levante el proyecto sin conocimiento implícito.

**Alcance:** prerequisitos, instalación, variables, PostgreSQL, migraciones, seeds, comandos y solución de fallos frecuentes.

**Criterios de aceptación:**

1. Desde un clon limpio se puede llegar a web y API funcionales siguiendo el README.
2. `npm run dev` inicia ambos procesos o documenta claramente el comando único equivalente.
3. Se documentan URLs locales y health checks.
4. No se incluyen instrucciones de hosting ni credenciales reales.

## 6. Cierre de la épica

E00 está `DONE` cuando ST01–ST10 cumplen sus criterios, los comandos raíz pasan y la documentación reproduce el entorno desde cero. Solo entonces E01–E04 pueden avanzar en paralelo donde sus dependencias lo permitan.
