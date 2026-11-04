# Database health check

Comprueba que la API puede adquirir una conexión del pool y ejecutar una
consulta mínima mediante Drizzle y PostgreSQL.

## Solicitud

```http
GET /api/v1/health/database
```

- Autenticación: no requerida.
- Parámetros, query y body: ninguno.

## Respuesta disponible

Código: `200 OK`

```json
{
  "status": "ok",
  "service": "database"
}
```

## Respuesta no disponible

Código: `503 Service Unavailable`

```json
{
  "status": "unavailable",
  "service": "database"
}
```

Contrato: `DatabaseHealthResponseSchema` exportado por
`@ludoteca/contracts`.

La respuesta nunca expone la cadena de conexión, detalles SQL, credenciales o
el mensaje interno del driver.

## Prueba automatizada

La prueba de integración de `apps/api/test/health.test.mjs` consulta una base
PostgreSQL real y cierra explícitamente el pool al finalizar.

