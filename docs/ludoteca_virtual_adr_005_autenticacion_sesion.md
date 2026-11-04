# ADR-005 — Autenticación propia y sesiones opacas

**Proyecto:** Ludoteca Virtual  
**Estado:** Aceptada  
**Fecha:** 21 de septiembre de 2026  
**Gate resuelto:** `G01`  
**Decisión:** credenciales locales y sesiones opacas persistidas en PostgreSQL

## 1. Contexto

E01 necesita una identidad estable para ownership, auditoría y contenido privado.
Express es responsable de autenticar y autorizar; Next.js consume su API y no
accede directamente a las credenciales ni a PostgreSQL.

## 2. Credencial inicial

- La autenticación inicial es propia mediante email y contraseña.
- El email y el username son únicos sin distinguir mayúsculas y minúsculas.
- OAuth, recuperación de cuenta y verificación de email quedan fuera de E01.
- Un registro válido crea la cuenta, el perfil, el rol base y una sesión en una
  sola transacción lógica.
- Los errores de login no revelan si el email existe.

## 3. Contraseñas

- Longitud permitida: de 15 a 128 caracteres.
- Se permiten espacios y Unicode sin imponer reglas de composición.
- No se recorta ni transforma silenciosamente la contraseña.
- Se almacena exclusivamente un hash Argon2id generado con `node:crypto`.
- La configuración mínima es 19 MiB de memoria, 2 iteraciones y paralelismo 1;
  podrá aumentarse después de medir el runtime objetivo.
- Contraseñas, hashes y parámetros secretos no se incluyen en respuestas ni
  logs.

`users.password_hash` contiene la representación autocontenida necesaria para
verificar y actualizar el hash. No se almacena la contraseña reversible.

## 4. Sesiones

- La API crea un token aleatorio opaco de 256 bits mediante un CSPRNG.
- El navegador recibe el token únicamente mediante cookie.
- PostgreSQL conserva un hash SHA-256 del token, no el token original.
- La sesión tiene un límite de inactividad de 7 días y un límite absoluto de
  30 días.
- Autenticar genera una sesión nueva para evitar fijación.
- Logout revoca la sesión actual. Desactivar la cuenta o cambiar su contraseña
  revoca todas sus sesiones.
- JWT no se adopta porque dificultaría la revocación inmediata sin aportar una
  ventaja al despliegue monolítico actual.

La tabla de sesiones se introduce con E01-ST04 para que el registro pueda crear
la sesión inicial atómicamente. E01-ST05 implementa login, consulta, renovación,
expiración y logout sobre ese modelo.

## 5. Cookie y transporte

En producción la cookie será `__Host-id`, con `HttpOnly`, `Secure`,
`SameSite=Lax`, `Path=/` y sin atributo `Domain`. En desarrollo HTTP se utiliza
`id` sin `Secure`; esa excepción no es válida para despliegues publicados.

El token no se acepta por query string, cuerpo, `localStorage` ni un mecanismo
alternativo. Las respuestas de autenticación y sesión usan
`Cache-Control: no-store`.

## 6. CORS y CSRF

- CORS permite únicamente el origen web configurado y credenciales; nunca `*`.
- Las operaciones de escritura requieren `Content-Type: application/json` y el
  encabezado `X-CSRF-Token`.
- El token CSRF se vincula a la sesión y se compara en tiempo constante.
- La API valida `Origin` y, como fallback, `Referer` en métodos no seguros.
- Registro y login, donde aún no existe una sesión, también validan el origen.

## 7. Autorización y estado de cuenta

- Express resuelve autenticación y permisos RBAC.
- Next.js puede adaptar la interfaz, pero no sustituye la autorización de API.
- Los roles iniciales son `USER`, `MODERATOR`, `CONTENT_MANAGER` y `ADMIN`.
- La ausencia de permiso deniega por defecto; ownership se comprueba además en
  el servicio o política del recurso.
- Desactivar una cuenta cambia su estado y conserva la fila y sus relaciones.

## 8. Protección contra abuso

Login tendrá limitación de intentos por IP e identificador normalizado. Los
límites concretos y su almacenamiento se incorporarán con E01-ST05 y deberán
ser configurables. La comparación de credenciales evita diferencias públicas
que permitan enumerar cuentas.

## 9. Consecuencias y revisión

La estrategia permite revocación inmediata y mantiene los secretos fuera del
cliente, a cambio de consultar estado de sesión en el servidor. Debe revisarse
si el sistema adopta múltiples servicios independientes, proveedores externos,
MFA o recuperación de cuenta.

## 10. Referencias

- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP — Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP — Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Node.js — Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)
