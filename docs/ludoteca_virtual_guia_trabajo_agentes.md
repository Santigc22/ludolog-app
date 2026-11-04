# Ludoteca Virtual — Guía de Trabajo para Agentes

**Estado:** Baseline v1.0  
**Fecha:** 19 de septiembre de 2026

## 1. Propósito

Definir cómo se prepara, asigna, ejecuta y entrega una historia cuando el
responsable de implementación es un agente.

Esta guía evita:

- cambios fuera de alcance;
- decisiones arquitectónicas improvisadas;
- duplicación de reglas;
- migraciones destructivas;
- features enormes difíciles de revisar;
- respuestas del tipo “implementado” sin evidencia.

---

## 2. Orden de lectura obligatorio

Antes de implementar una historia, el agente debe leer:

1. la instrucción actual del usuario;
2. la historia asignada dentro de su archivo de épica;
3. las reglas del dominio referenciadas por ID;
4. `ludoteca_virtual_arquitectura_aplicacion.md`;
5. los ADR citados por la historia;
6. el código y tests existentes del módulo afectado.

El agente no necesita leer todos los documentos del proyecto si la historia
identifica referencias suficientes. Sí debe detenerse si una dependencia
necesaria no está documentada.

---

## 3. Jerarquía de autoridad

En caso de conflicto:

```text
Instrucción explícita actual del usuario
    ↓
Reglas funcionales vigentes del dominio
    ↓
ADR aceptados y arquitectura vigente
    ↓
Historia y criterios de aceptación
    ↓
Convenciones existentes del código
```

Una historia no puede contradecir una regla funcional. Si parece hacerlo, el
agente debe detenerse y reportar el conflicto; no debe elegir silenciosamente.

---

## 4. Definition of Ready

Una historia solo puede marcarse `READY` si contiene:

- ID y título;
- objetivo/valor;
- dependencias satisfechas;
- alcance;
- fuera de alcance;
- reglas referenciadas;
- módulos o rutas autorizadas;
- contrato esperado cuando aplique;
- criterios de aceptación comprobables;
- estrategia mínima de pruebas;
- decisiones pendientes resueltas;
- Definition of Done aplicable.

Si falta una decisión material, la historia es `BLOCKED`.

---

## 5. Límites generales

El agente:

- modifica únicamente los workspaces y módulos autorizados;
- preserva cambios previos del usuario;
- no renombra conceptos del dominio sin autorización;
- no agrega dependencias si la historia no lo permite;
- no reemplaza herramientas elegidas en los ADR;
- no modifica el ERD para acomodar una implementación más fácil;
- no ejecuta `drizzle-kit push` en ambientes compartidos;
- no reescribe migraciones ya aplicadas;
- no implementa features futuras “aprovechando” la historia actual;
- no crea abstracciones genéricas sin un consumidor real;
- no agrega hosting, cloud o CI/CD externo durante la etapa local;
- no incluye secretos ni credenciales en archivos versionados;
- no elimina historial funcional;
- no silencia errores de compilación o pruebas.

---

## 6. Reglas de arquitectura para toda historia

- Express conserva las reglas de negocio.
- Next.js no accede a PostgreSQL.
- Flujo backend: Route → Middleware → Controller → Service → Repository.
- Controllers no ejecutan SQL.
- Services no dependen de `Request`/`Response`.
- Repositories no deciden permisos.
- Contratos públicos viven en `packages/contracts` con Zod.
- DTO y tabla no son el mismo modelo.
- Permiso global y acceso al recurso se validan por separado.
- Transacciones pertenecen al caso de uso, no a actualizaciones dispersas.
- Audit Log no reemplaza históricos de negocio.

---

## 7. Protocolo de implementación

### Antes de editar

El agente debe indicar:

1. historia que implementará;
2. dependencias verificadas;
3. archivos/workspaces que espera modificar;
4. pruebas que ejecutará;
5. bloqueos detectados.

### Durante el trabajo

- Mantener cambios pequeños y cohesionados.
- Validar temprano compilación y contratos.
- No continuar sobre una migración incorrecta.
- Comunicar un bloqueo antes de inventar una solución fuera del alcance.

### Al entregar

Debe informar:

- resumen del comportamiento implementado;
- archivos modificados;
- migraciones y seeds creados;
- pruebas ejecutadas y resultado;
- criterios de aceptación verificados;
- decisiones tomadas dentro del margen permitido;
- riesgos o trabajo pendiente;
- confirmación de que no se implementó alcance adicional.

---

## 8. Stop conditions

El agente debe detenerse si:

- falta una decisión marcada como gate;
- el schema real contradice el ERD vigente;
- una historia exige cambiar una regla del dominio;
- necesita modificar un workspace no autorizado;
- aparece una migración destructiva no prevista;
- debe escoger autenticación, testing, hosting o almacenamiento sin ADR;
- detecta cambios del usuario que entrarían en conflicto;
- no puede ejecutar una prueba obligatoria;
- necesita credenciales no disponibles;
- la solución requiere ampliar materialmente el alcance.

Detenerse y preguntar es un resultado correcto; improvisar no lo es.

---

## 9. Definition of Done general

Una historia de código está `DONE` cuando:

- cumple todos sus criterios de aceptación;
- compila con TypeScript estricto;
- pasa lint y formatting configurados;
- pasan las pruebas requeridas;
- no deja pruebas deshabilitadas;
- contratos públicos están actualizados;
- migraciones/seeds están incluidos cuando aplica;
- errores siguen el formato del proyecto;
- permisos y privacidad fueron comprobados;
- no expone datos sensibles;
- documentación afectada está actualizada;
- el agente entrega evidencia de los comandos ejecutados.

Si una herramienta de calidad todavía no existe, la historia deberá quedar en
`REVIEW` o declarar explícitamente la excepción aprobada; no se asumirá que
pasó.

---

## 10. Plantilla de historia asignable

```markdown
# [ID] — [Título]

**Épica:**
**Feature:**
**Estado:** READY | BLOCKED
**Dependencias:**

## Objetivo

Como [actor], quiero [capacidad], para [valor].

## Referencias obligatorias

- Regla(s): R-...
- Arquitectura: sección ...
- ADR: ADR-...

## Alcance

- ...

## Fuera de alcance

- ...

## Workspaces/módulos autorizados

- ...

## Contrato esperado

- Método/ruta o API interna
- Entrada
- Salida
- Errores

## Criterios de aceptación

- [ ] ...

## Pruebas requeridas

- ...

## Definition of Done adicional

- ...

## Stop conditions específicas

- ...
```

---

## 11. Tamaño recomendado

Una historia asignable debería normalmente:

- modificar un solo dominio principal;
- tener entre uno y cinco comportamientos observables;
- poder revisarse sin entender toda la aplicación;
- completarse sin rediseñar la arquitectura;
- evitar mezclar migración masiva, backend completo y UI completa en un solo
  paquete.

Si una historia crea schema, API y UI, solo será aceptable cuando cada parte sea
pequeña y forme una vertical realmente cohesionada. De lo contrario debe
dividirse.

---

## 12. Trabajo paralelo

Dos agentes pueden trabajar en paralelo cuando:

- las historias no modifican los mismos archivos raíz;
- no generan migraciones concurrentes sobre el mismo baseline;
- no editan simultáneamente `package-lock.json`;
- sus contratos ya fueron acordados;
- no dependen una de la salida incompleta de la otra.

Durante E00 se prefiere trabajo secuencial porque muchas historias afectan
configuración compartida. El paralelismo aumentará después de estabilizar el
monorepo.

