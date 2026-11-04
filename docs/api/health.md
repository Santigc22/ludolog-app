# Health check

Comprueba que el proceso HTTP de la API está iniciado y puede responder. No
consulta PostgreSQL; el health check de base de datos pertenece a `E00-ST06`.

## Solicitud

```http
GET /api/v1/health
```

- Autenticación: no requerida.
- Parámetros de ruta: ninguno.
- Query parameters: ninguno.
- Body: ninguno.

## Respuesta exitosa

Código: `200 OK`

```json
{
  "status": "ok",
  "service": "ludoteca-api"
}
```

Contrato: `HealthResponseSchema` exportado por `@ludoteca/contracts`.

## Errores

Este endpoint no define errores funcionales. Los errores HTTP transversales y
el formato público central se incorporarán en `E00-ST08`.

## Prueba automatizada

`apps/api/test/health.test.mjs` comprueba el código HTTP y valida la respuesta
con el mismo contrato Zod compartido.

