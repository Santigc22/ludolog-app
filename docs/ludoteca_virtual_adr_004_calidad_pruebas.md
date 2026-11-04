# ADR-004 — Herramientas de pruebas, lint y formato

**Proyecto:** Ludoteca Virtual  
**Estado:** Aceptada  
**Fecha:** 21 de septiembre de 2026  
**Gate resuelto:** `G02`  
**Decisión:** Vitest, Testing Library, ESLint flat config y Prettier

## 1. Propósito

Definir una base de calidad reproducible para todos los workspaces sin
convertir las herramientas en una segunda arquitectura del proyecto.

Esta decisión desbloquea `E00-ST09`.

## 2. Decisión

Se adoptan las siguientes herramientas:

| Necesidad | Herramienta |
|---|---|
| Tests unitarios e integración TypeScript | Vitest |
| Cobertura | `@vitest/coverage-v8` |
| Componentes React cliente | Testing Library + `jest-dom` + jsdom |
| Lint JavaScript/TypeScript | ESLint con flat config |
| Reglas TypeScript | typescript-eslint |
| Reglas Next.js/React | configuración oficial de Next.js |
| Evitar conflictos de estilo | eslint-config-prettier |
| Formato | Prettier instalado localmente y con versión fijada |
| E2E de navegador | Playwright, activado en E01-ST08 |

## 3. Estrategia de pruebas

### 3.1 Unitarias

Cubren funciones puras, schemas Zod, políticas, servicios y transformaciones.
No utilizan red, reloj real ni PostgreSQL salvo que esa sea precisamente la
integración bajo prueba.

### 3.2 Integración de API

La aplicación Express se importa sin abrir un puerto fijo. Las pruebas pueden
usar una interfaz HTTP en memoria o un listener efímero administrado por el
runner. Los repositories y migraciones se validan contra PostgreSQL real.

### 3.3 Integración PostgreSQL

1. Utiliza exclusivamente `ludoteca_test`.
2. La URL de pruebas se configura de forma explícita; nunca se deriva
   silenciosamente reemplazando el nombre de `ludoteca_dev`.
3. Cada suite deja el estado conocido o utiliza transacciones/limpieza
   controlada.
4. Ningún test destructivo puede ejecutarse contra una base cuyo nombre no
   coincida con la política de entorno de pruebas.
5. Los pools se cierran al terminar.

### 3.4 Web

Testing Library se utiliza para comportamiento observable de Client
Components, formularios y accesibilidad básica. No se prueban detalles internos
de implementación.

Los Server Components async y los recorridos reales entre navegador, Next.js y
Express se prueban mediante E2E. Playwright fue instalado en E01-ST08 junto con
el primer consumidor real: registro, perfil y logout.

### 3.5 Tests contractuales

Los contratos públicos se prueban directamente desde sus schemas Zod con casos
válidos e inválidos. API y web reutilizan esos mismos schemas.

## 4. Convenciones

- Archivos: `*.test.ts` y `*.test.tsx` cerca del workspace correspondiente.
- Vitest es el runner; los tests provisionales `*.test.mjs` con `node:test` se
  migrarán en `E00-ST09`.
- No se mezclan tests unitarios con scripts manuales de diagnóstico.
- Tests deshabilitados o `only` no se aceptan en la entrega.
- Los tests deben ser deterministas y cerrar recursos.
- Los fallos de cualquier workspace producen exit code distinto de cero.

## 5. Cobertura

`E00-ST09` configurará cobertura V8 y un baseline inicial alcanzable. Los
umbrales podrán aumentar con el dominio, pero no se usarán porcentajes altos
artificiales que incentiven pruebas sin valor.

La cobertura no reemplaza escenarios de autorización, concurrencia,
transacciones o migraciones.

## 6. Lint

ESLint utilizará configuración plana en la raíz del monorepo.

Debe comprobar como mínimo:

- JavaScript y TypeScript de todos los workspaces;
- reglas recomendadas de TypeScript;
- reglas oficiales aplicables a Next.js y React Hooks;
- imports y variables no utilizadas;
- ausencia de directivas de desactivación innecesarias;
- diferencias entre código de navegador y servidor.

Las restricciones arquitectónicas de imports podrán añadirse cuando existan
módulos suficientes para expresarlas sin falsos positivos.

## 7. Formato

Prettier es el único responsable del formato. ESLint no aplicará reglas de
estilo que compitan con él.

Scripts raíz esperados:

```text
npm run lint
npm run format
npm run format:check
npm run typecheck
npm test
npm run test:coverage
```

Prettier se instala localmente con versión exacta y respeta un archivo de
ignores para artefactos, migraciones generadas y archivos que no deban
reescribirse automáticamente.

## 8. Alternativas consideradas

### Node test runner como estándar definitivo

Fue útil para el bootstrap porque no requería una dependencia adicional. No se
elige como estándar final porque Vitest ofrece transformación TypeScript,
watch, mocks, cobertura y mejor integración con React mediante una sola
convención.

### Jest

Es viable, pero requiere más adaptación para ESM, TypeScript y la configuración
actual de Next.js. No aporta una ventaja suficiente frente a Vitest en este
proyecto.

### Biome

Ofrece lint y formato con excelente rendimiento. Se mantiene como alternativa
futura, pero ESLint dispone de reglas oficiales y específicas de Next.js más
directas para la arquitectura elegida.

### Playwright desde la fundación

Se difiere porque todavía no existe un flujo funcional que justifique instalar
navegadores y mantener pruebas E2E. La herramienta queda aprobada para cuando
E01 proporcione el primer recorrido real.

## 9. Fuera de alcance

- CI/CD externo;
- hooks de Git, Husky o lint-staged;
- servicios de cobertura alojados;
- pruebas visuales o de rendimiento;
- navegadores de Playwright antes de una historia consumidora.

## 10. Condiciones para revisar la decisión

- incompatibilidad demostrada de Vitest con una parte crítica de Next.js;
- tiempos de ejecución que impidan feedback local útil;
- reglas necesarias no representables con ESLint;
- mantenimiento duplicado entre unitarias y E2E;
- cambio de runtime o framework principal.

## 11. Referencias oficiales

- [Next.js — Testing](https://nextjs.org/docs/app/guides/testing)
- [Vitest — Guide](https://vitest.dev/guide/)
- [Testing Library — React](https://testing-library.com/docs/react-testing-library/intro/)
- [ESLint — Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint — Getting Started](https://typescript-eslint.io/getting-started/)
- [Prettier — Install](https://prettier.io/docs/install)
