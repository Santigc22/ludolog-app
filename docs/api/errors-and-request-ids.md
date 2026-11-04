# Errores públicos y request IDs

Todas las respuestas de la API incluyen el header `x-request-id`. El cliente
puede enviar uno con el mismo nombre si contiene entre 1 y 128 caracteres
alfanuméricos, punto, guion o guion bajo. Un valor ausente o inválido se
reemplaza por un UUID generado por la API.

## Formato de error

```json
{
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "The requested route does not exist.",
    "details": null,
    "requestId": "b63b3f22-5a87-4b6b-bf52-f8823fc25c18"
  }
}
```

- `code` es estable y puede utilizarse para comportamiento del cliente.
- `message` es legible, pero puede cambiar o traducirse.
- `details` contiene información pública estructurada o `null`.
- `requestId` permite correlacionar la respuesta con logs técnicos.

Los errores inesperados responden con `INTERNAL_SERVER_ERROR` y código HTTP
`500`; nunca incluyen stack traces, SQL, credenciales ni mensajes internos.

## Ruta inexistente

Una combinación de método/ruta que no exista responde:

```http
404 Not Found
```

con código público `ROUTE_NOT_FOUND`.

## Logs técnicos

Al finalizar cada solicitud, la API escribe una entrada JSON con:

- timestamp;
- nivel y evento;
- request ID;
- método y ruta;
- código HTTP;
- duración en milisegundos.

No se registran headers ni bodies por defecto. El logger redacta claves
sensibles, tokens Bearer y cadenas de conexión PostgreSQL. Estos logs son
técnicos y no sustituyen el Audit Log funcional.

