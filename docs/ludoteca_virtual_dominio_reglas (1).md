# Ludoteca Virtual --- Documento de Dominio y Reglas de Negocio

**Estado:** Baseline funcional v1.1\
**Fecha:** 16 de septiembre de 2026\
**Propósito del documento:** Definir la visión, conceptos del dominio,
relaciones, reglas de negocio y decisiones funcionales iniciales de la
aplicación antes de diseñar el modelo lógico/físico de base de datos y
comenzar su implementación.

------------------------------------------------------------------------

## 1. Visión del proyecto

**Ludoteca Virtual** será una plataforma para gestionar, registrar,
descubrir y compartir la experiencia alrededor de los juegos de mesa.

La aplicación no será únicamente un catálogo de juegos. Cada usuario
podrá administrar una o varias ludotecas, individualmente o junto con
otras personas; registrar las copias físicas que posee; registrar
partidas y sus resultados; analizar estadísticas personales, grupales y
globales; gestionar préstamos, ventas e intercambios; valorar juegos;
descubrir nuevos títulos y participar en funcionalidades sociales.

El sistema distinguirá claramente entre:

-   el juego como concepto;
-   sus ediciones o versiones;
-   las copias físicas que poseen los usuarios;
-   las ludotecas donde se encuentran esas copias;
-   las partidas jugadas;
-   las personas que participaron;
-   las valoraciones y opiniones;
-   la información privada, grupal y pública;
-   y los datos calculados o estadísticos.

El objetivo del diseño de dominio es evitar duplicidad de información,
preservar el historial y permitir que la aplicación crezca sin convertir
la base de datos en un conjunto de estructuras rígidas difíciles de
mantener.

------------------------------------------------------------------------

## 2. Principios generales del dominio

### 2.1 Existencia, visibilidad y acceso son conceptos diferentes

Que un recurso exista en la base de datos no significa que deba aparecer
públicamente.

Por ejemplo, un usuario puede crear un juego privado llamado **La Guerra
de las Arepas**, registrar partidas, expansiones, imágenes y
estadísticas, y compartirlo directamente con otras personas. Sin
embargo, ese juego no debe aparecer en búsquedas ni en el catálogo
global mientras continúe siendo privado.

Se distinguen por tanto:

-   **Existencia:** el recurso existe dentro del sistema.
-   **Visibilidad:** determina quién puede descubrirlo normalmente.
-   **Acceso compartido:** permite conceder acceso explícito sin
    modificar su visibilidad original.

### 2.2 Propiedad y actividad son independientes

Un usuario no necesita poseer un juego para registrar una partida.

Puede haberlo jugado:

-   en casa de otra persona;
-   en una tienda;
-   en un evento;
-   mediante un préstamo;
-   mediante alquiler;
-   o en cualquier otro contexto.

### 2.3 El historial debe preservarse

Vender, intercambiar, mover, archivar o dejar de poseer una copia no
debe eliminar las partidas, transacciones o estadísticas históricas
relacionadas.

### 2.4 Las estadísticas derivadas no son la fuente de verdad

Datos como:

-   juego más jugado;
-   porcentaje de victorias;
-   rating global;
-   categorías favoritas;
-   número de partidas;
-   juegos nunca jugados;

deben derivarse principalmente de los registros originales.

Posteriormente podrán existir cachés, vistas materializadas, agregados o
snapshots por rendimiento, pero no reemplazarán los datos fuente.

### 2.5 La información opcional debe ser realmente opcional

Registrar un juego no debe convertirse en una tarea tediosa.

Datos como diseñador, ilustrador, editorial exacta, edición,
identificadores comerciales o estadísticas avanzadas pueden omitirse
cuando el usuario no los conozca.

------------------------------------------------------------------------

# 3. Áreas principales del sistema

El dominio se divide conceptualmente en:

1.  **Identidad y perfiles**
2.  **Grupos y relaciones sociales**
3.  **Ludotecas y propiedad**
4.  **Catálogo de juegos**
5.  **Ediciones y publicaciones**
6.  **Partidas y resultados**
7.  **Ratings, reviews y favoritos**
8.  **Wishlist**
9.  **Préstamos**
10. **Ventas**
11. **Trueques/intercambios**
12. **Compartición y privacidad**
13. **Moderación**
14. **Estadísticas**
15. **Calendario**
16. **Recomendaciones**
17. **Auditoría**

------------------------------------------------------------------------

# 4. Conceptos del dominio

## 4.1 User --- Usuario

Representa la cuenta utilizada para acceder al sistema.

Contendrá conceptualmente información como:

-   identificador;
-   username;
-   email;
-   credenciales seguras;
-   estado de la cuenta;
-   fecha de creación;
-   fecha de actualización.

Las contraseñas nunca deben almacenarse en texto plano.

El usuario no debe confundirse con su perfil público.

------------------------------------------------------------------------

## 4.2 Profile --- Perfil

Representa la información con la que un usuario decide presentarse
dentro de la aplicación.

Puede incluir:

-   nombre;
-   avatar;
-   biografía;
-   ubicación general;
-   información personal opcional;
-   preferencias;
-   configuración de visibilidad.

El perfil puede ser público o privado según la decisión del usuario.

------------------------------------------------------------------------

## 4.3 Role / Permission --- Roles y permisos

Los usuarios pueden tener distintos roles dentro de la plataforma.

Ejemplos:

-   User;
-   Moderator;
-   Administrator;
-   Content Manager.

El diseño debe permitir evolucionar hacia un modelo de roles y permisos
en lugar de depender exclusivamente de un único `user_type`.

------------------------------------------------------------------------

## 4.4 Group --- Grupo

Representa un conjunto de usuarios relacionado por algún propósito.

Puede representar:

-   familia;
-   pareja;
-   amigos;
-   grupo habitual de juegos;
-   compañeros de trabajo;
-   cualquier otro colectivo.

Un usuario puede pertenecer a varios grupos y un grupo puede contener
varios usuarios.

Los miembros pueden tener diferentes roles, como Owner, Admin o Member.

------------------------------------------------------------------------

## 4.5 Collection --- Ludoteca

Representa una colección organizada de copias físicas de juegos.

Una ludoteca puede pertenecer:

-   únicamente a una persona;
-   o a un grupo.

Los miembros autorizados pueden tener acceso para gestionarla según sus
permisos.

Una persona puede pertenecer o administrar múltiples ludotecas.

Ejemplos:

-   Mi Ludoteca;
-   Juegos de la Familia;
-   Colección con mi pareja;
-   Juegos para Venta.

### Ludotecas de venta

Una ludoteca puede marcarse específicamente como destinada a venta.

Cuando una copia pertenece a una ludoteca de venta, puede adquirir
comportamiento de artículo comercial, permitiendo registrar:

-   precio;
-   moneda;
-   disponibilidad;
-   estado;
-   publicación;
-   estadísticas de ventas.

------------------------------------------------------------------------

## 4.6 Collection Item / Copy --- Copia o ejemplar

Representa una unidad física concreta que alguien posee.

Debe distinguirse del juego conceptual.

Ejemplo:

-   `Catan` es el juego.
-   `Catan #1` es una copia física.
-   `Catan #2` es otra copia física.

Una persona podría tener una copia en su ludoteca personal y otra en una
ludoteca de venta.

Cada copia activa pertenece a una sola ludoteca en un momento determinado.

Cuando una copia sale de la posesión administrada ---por venta externa,
trueque externo, regalo, donación, pérdida, descarte, daño u otra causa--- se
conserva históricamente, pero deja de pertenecer a una ludoteca activa.

Una copia puede moverse entre ludotecas sin crear una nueva copia.

La edición concreta de la copia puede ser opcional si el usuario no sabe
cuál posee.

------------------------------------------------------------------------

## 4.7 Acquisition --- Adquisición

Representa cómo llegó una copia a una ludoteca.

Posibles tipos:

-   PURCHASE;
-   GIFT;
-   TRADE;
-   INHERITED;
-   WON;
-   OTHER.

Puede contener opcionalmente:

-   fecha;
-   precio;
-   moneda;
-   vendedor/tienda;
-   notas.

Un regalo con precio desconocido no debe interpretarse como una compra
por valor cero.

------------------------------------------------------------------------

## 4.8 Game --- Juego

Representa el juego como concepto general, independientemente de
editorial, idioma o edición.

Ejemplo:

`Catan`

puede tener múltiples ediciones publicadas por diferentes editoriales y
en diferentes idiomas.

Información conceptual posible:

-   nombre;
-   descripción;
-   año de publicación;
-   jugadores mínimos;
-   jugadores máximos;
-   duración mínima;
-   duración máxima;
-   edad recomendada;
-   complejidad;
-   tipo de resultado;
-   sistema de puntuación;
-   imagen principal;
-   categorías;
-   mecánicas.

------------------------------------------------------------------------

## 4.9 Game Edition --- Edición

Representa una edición/publicación concreta de un juego.

Puede distinguir:

-   editorial;
-   idioma;
-   año;
-   número o nombre de edición;
-   imagen;
-   información específica;
-   identificadores comerciales opcionales.

Ejemplo:

-   Catan --- Devir --- Español --- edición antigua;
-   Catan --- Devir --- Español --- edición nueva;
-   Catan --- Kosmos --- Alemán.

Los identificadores como ISBN, SKU, UPC u otros se consideran
soportables pero opcionales y deberán evaluarse durante el diseño
lógico.

------------------------------------------------------------------------

## 4.10 Publisher --- Editorial

Representa una editorial o empresa relacionada con la publicación de una
edición.

La editorial debe asociarse principalmente con la edición y no asumirse
como una característica universal del juego.

------------------------------------------------------------------------

## 4.11 Person --- Persona relacionada con un juego

Representa personas que hayan participado en la creación del juego.

Puede tener roles como:

-   diseñador;
-   autor;
-   ilustrador;
-   artista;
-   desarrollador;
-   otros.

Estos datos deben ser opcionales.

------------------------------------------------------------------------

## 4.12 Category --- Categoría

Clasifica temáticamente los juegos.

Un juego puede tener múltiples categorías y una categoría puede
pertenecer a múltiples juegos.

------------------------------------------------------------------------

## 4.13 Mechanic --- Mecánica

Representa las mecánicas de juego.

Ejemplos:

-   Hidden Roles;
-   Social Deduction;
-   Worker Placement;
-   Deck Building;
-   Area Control;
-   Dice Rolling.

Un juego puede tener múltiples mecánicas y una mecánica puede aparecer
en múltiples juegos.

------------------------------------------------------------------------

## 4.14 Game Relationship --- Relación entre juegos

Permite relacionar juegos entre sí.

Ejemplos de relaciones:

-   EXPANSION_OF;
-   STANDALONE_EXPANSION;
-   SEQUEL;
-   REIMPLEMENTATION;
-   VARIANT;
-   PROMO.

Una expansión sigue siendo conceptualmente un juego, pero se relaciona
con su juego base.

------------------------------------------------------------------------

## 4.15 Expansion --- Expansiones

Una expansión se representa como un juego relacionado con otro juego.

Una expansión dependiente requiere el juego base para registrar una
partida.

Debe existir un parámetro que permita distinguir una expansión:

-   dependiente del juego base;
-   jugable de manera independiente.

Los juegos privados también pueden tener expansiones privadas.

------------------------------------------------------------------------

## 4.16 Accessory --- Accesorio

Representa elementos relacionados con juegos que no son expansiones.

Ejemplos:

-   sleeves;
-   inserts;
-   dados;
-   tapetes;
-   organizadores;
-   componentes premium.

Los accesorios pueden ser oficiales o externos/comunitarios.

------------------------------------------------------------------------

## 4.17 Game Resource --- Recursos del juego

Permite asociar distintos recursos sin crear columnas rígidas para cada
tipo.

Ejemplos:

-   reglamento PDF;
-   enlace a reglamento;
-   tutorial;
-   video;
-   sitio oficial;
-   recurso adicional.

------------------------------------------------------------------------

## 4.18 Personal Game Note --- Nota personal

Permite que un usuario describa un juego de la manera que le resulte más
útil.

Ejemplo:

> "El juego que se cae la isla poco a poco y le gusta bastante a Mati y
> Tomi."

La nota:

-   pertenece al usuario;
-   referencia un juego;
-   es privada por defecto;
-   no modifica la descripción oficial;
-   puede editarse o eliminarse por su propietario.

------------------------------------------------------------------------

## 4.19 Match / Game Session --- Partida

Representa una sesión concreta de juego.

Puede contener:

-   juego;
-   fecha;
-   hora;
-   duración;
-   ubicación;
-   participantes;
-   expansiones utilizadas;
-   resultados;
-   estadísticas;
-   imágenes;
-   notas;
-   visibilidad;
-   estado de la partida.

Una partida no requiere que el usuario posea una copia del juego.

------------------------------------------------------------------------

## 4.20 Match Participant --- Participante

Representa a alguien que participó en una partida.

Puede corresponder a:

-   un usuario registrado;
-   un jugador invitado sin cuenta.

No debe obligarse a una persona a crear una cuenta para aparecer en una
partida.

------------------------------------------------------------------------

## 4.21 Match Result --- Resultado

Representa el resultado de los participantes y no debe reducirse a un
único `winner_id`.

Debe soportar:

-   ganador único;
-   ranking/podio;
-   equipos;
-   cooperativo;
-   objetivos;
-   puntuación;
-   múltiples ganadores;
-   empates.

------------------------------------------------------------------------

## 4.22 Scoring System --- Sistema de puntuación

El juego puede definir cómo se interpreta su puntuación.

Ejemplos conceptuales:

-   POINTS;
-   MONEY;
-   TIME;
-   OBJECTIVES;
-   NONE;
-   CUSTOM.

También puede indicar si:

-   un valor mayor es mejor;
-   un valor menor es mejor;
-   la comparación numérica no aplica.

El diseño definitivo debe mantenerse flexible.

------------------------------------------------------------------------

## 4.23 Match Statistic Definition / Match Statistic --- Estadísticas flexibles

Los juegos pueden definir estadísticas específicas.

Ejemplo para Catan:

-   Victory Points;
-   Longest Road;
-   Largest Army.

Ejemplo para otro juego:

-   Money;
-   Turns;
-   Objectives;
-   Resources.

El sistema no debe intentar representar todas las estadísticas posibles
mediante columnas universales.

El registro de estadísticas avanzadas debe ser opcional.

------------------------------------------------------------------------

## 4.24 Rating --- Valoración

Representa la calificación de un usuario sobre un juego.

El rating global se deriva de las valoraciones elegibles y no debe ser
la fuente primaria almacenada manualmente.

------------------------------------------------------------------------

## 4.25 Review --- Reseña

Representa una opinión escrita sobre un juego.

Rating y review son conceptos diferentes, aunque pueden registrarse
conjuntamente.

Un usuario puede:

-   calificar sin escribir reseña;
-   escribir reseña sin calificación;
-   realizar ambas acciones.

Las reviews pueden recibir likes/dislikes y comentarios.

------------------------------------------------------------------------

## 4.26 Favorite --- Favorito

Representa la relación entre un usuario y un juego marcado como
favorito.

Los favoritos globales o grupales se derivan de estas relaciones.

------------------------------------------------------------------------

## 4.27 Wishlist --- Lista de deseos

Permite registrar juegos que un usuario desea adquirir.

Puede incluir:

-   prioridad;
-   fecha;
-   notas;
-   precio objetivo;
-   estado.

Wishlist y favoritos son conceptos independientes.

------------------------------------------------------------------------

## 4.28 Follow --- Seguimiento

Un usuario puede seguir a otro.

El seguimiento no tiene que ser recíproco.

Cuando A sigue a B y B sigue a A, ambos pueden considerarse amigos
conceptualmente.

La amistad no concede acceso automático al contenido privado.

------------------------------------------------------------------------

## 4.29 Comment --- Comentario

Permite comentar contenido social compatible, inicialmente reviews y
potencialmente partidas u otros recursos.

------------------------------------------------------------------------

## 4.30 Reaction --- Reacción

Permite registrar reacciones sobre contenido.

Inicialmente:

-   LIKE;
-   DISLIKE.

Debe diseñarse de forma suficientemente flexible para reutilizarse
posteriormente.

------------------------------------------------------------------------

## 4.31 Loan --- Préstamo

Representa el préstamo temporal de una copia.

Puede registrar:

-   copia;
-   propietario;
-   prestatario;
-   fecha;
-   fecha esperada de devolución;
-   fecha real;
-   estado;
-   notas.

Un préstamo no cambia la propiedad de la copia.

------------------------------------------------------------------------

## 4.32 Trade --- Trueque/intercambio

Representa una transacción donde dos partes intercambian copias.

Puede contener:

-   parte A;
-   parte B;
-   copias entregadas por A;
-   copias entregadas por B;
-   estado;
-   fechas.

Estados posibles:

-   PROPOSED;
-   ACCEPTED;
-   REJECTED;
-   CANCELLED;
-   COMPLETED.

La transferencia de propiedad solo ocurre cuando el intercambio se
completa.

------------------------------------------------------------------------

## 4.33 Sale Listing / Sale Transaction --- Venta

Debe distinguirse entre:

-   una copia publicada para venta;
-   una venta efectivamente realizada.

Una venta completada debe conservar su historial.

Si el comprador utiliza la plataforma y dispone de una ludoteca destino,
la misma copia puede transferirse entre ludotecas sin crear una copia
nueva.

Vender una copia nunca elimina las partidas históricas realizadas con
ese juego.

------------------------------------------------------------------------

## 4.34 Share --- Compartir

Representa el acceso explícito concedido sobre contenido.

Puede permitir compartir:

-   juegos privados;
-   partidas;
-   ludotecas;
-   reviews;
-   otros recursos compatibles.

Compartir un recurso no modifica automáticamente su visibilidad.

Ejemplo:

`La Guerra de las Arepas` continúa siendo PRIVATE aunque su creador la
comparta directamente con otra persona o mediante un enlace.

El acceso compartido puede contemplar:

-   destinatario directo;
-   enlace;
-   permisos;
-   expiración.

Permisos posibles:

-   VIEW;
-   COMMENT;
-   EDIT.

------------------------------------------------------------------------

## 4.35 Moderation --- Moderación

Permite revisar contenido propuesto para publicación global.

Estados conceptuales:

-   DRAFT;
-   PENDING_REVIEW;
-   APPROVED;
-   REJECTED;
-   REJECTED_DUPLICATE;
-   BLOCKED;
-   ARCHIVED.

Debe mantenerse un historial de acciones de moderación.

------------------------------------------------------------------------

## 4.36 Game Merge --- Fusión de juegos

Permite resolver duplicados.

Ejemplo:

Un usuario crea `Catan`, registra partidas y posteriormente un moderador
detecta que el juego oficial ya existe.

El sistema debe poder vincular o migrar información compatible hacia el
juego oficial sin perder historial.

La operación debe ser explícita, auditable y segura.

------------------------------------------------------------------------

## 4.37 Recommendation Engine --- Recomendaciones

El sistema podrá recomendar juegos basándose en el comportamiento y
preferencias inferidas del usuario.

Se podrán considerar:

-   frecuencia de partidas;
-   recencia;
-   ratings;
-   favoritos;
-   wishlist;
-   categorías;
-   mecánicas;
-   duración;
-   complejidad;
-   número habitual de jugadores.

Ejemplo:

Si una persona juega repetidamente juegos de roles ocultos y deducción
social, el sistema puede recomendar títulos similares.

Las preferencias no necesitan almacenarse inicialmente como afirmaciones
manuales; pueden derivarse de la actividad.

------------------------------------------------------------------------

## 4.38 Calendar --- Calendario de actividad

El calendario no necesita ser una entidad de negocio independiente.

Se construye a partir de las fechas de las partidas.

Debe permitir consultar:

-   partidas de un día;
-   actividad mensual;
-   actividad anual;
-   número de partidas;
-   juegos jugados;
-   detalle de las partidas de una fecha concreta.

Puede existir una vista:

-   personal;
-   de ludoteca;
-   de grupo;

siempre respetando permisos y visibilidad.

------------------------------------------------------------------------

## 4.39 Audit Log --- Registro de auditoría

Registra operaciones relevantes realizadas en el sistema.

Debe permitir conocer:

-   quién realizó la acción;
-   qué hizo;
-   sobre qué entidad;
-   cuándo;
-   estado anterior;
-   estado posterior;
-   motivo/contexto cuando corresponda.

Ejemplos:

-   juego aprobado;
-   juego bloqueado;
-   juego fusionado;
-   copia movida;
-   préstamo creado;
-   préstamo devuelto;
-   venta completada;
-   trueque completado;
-   miembro agregado;
-   permiso modificado;
-   contenido compartido.

El Audit Log no reemplaza las entidades históricas del negocio.

Una venta debe seguir existiendo como venta; el Audit Log únicamente
registra que la operación ocurrió.

------------------------------------------------------------------------

# 5. Clasificación, moderación y visibilidad de juegos

Estos conceptos deben mantenerse separados.

## 5.1 Clasificación

Un juego puede ser:

### OFFICIAL

Juego reconocido/publicado y perteneciente al catálogo global.

### COMMUNITY

Juego creado por usuarios y aprobado para publicación
comunitaria/global.

### PRIVATE

Juego creado para uso privado.

Un juego privado puede tener toda la funcionalidad necesaria para
registrar partidas y estadísticas sin aparecer en el catálogo global.

## 5.2 Moderación

Un recurso puede encontrarse en estados como:

-   DRAFT;
-   PENDING_REVIEW;
-   APPROVED;
-   REJECTED;
-   REJECTED_DUPLICATE;
-   BLOCKED;
-   ARCHIVED.

## 5.3 Visibilidad

Los niveles conceptuales iniciales son:

-   PRIVATE;
-   GROUP;
-   PUBLIC.

La visibilidad determina descubribilidad normal.

El mecanismo Share concede acceso excepcional sin convertir el recurso
en público.

Cuando la visibilidad sea `GROUP`, el recurso debe identificar el grupo
concreto que delimita su alcance. Los recursos para los que ese alcance no
tiene significado solo permiten `PRIVATE` o `PUBLIC`.

------------------------------------------------------------------------

# 6. Reglas de negocio

## 6.1 Usuarios y relaciones sociales

### R-USER-01

Cada usuario debe poseer un identificador único.

### R-USER-02

Cuenta y perfil son conceptos separados.

### R-USER-03

Un usuario puede seguir a otro.

### R-USER-04

El follow puede ser unilateral.

### R-USER-05

Dos usuarios pueden considerarse amigos cuando se siguen mutuamente.

### R-USER-06

Ser amigos no concede acceso automático a contenido privado.

### R-USER-07

La privacidad de perfil, ludotecas, partidas y otros recursos debe
respetarse independientemente.

------------------------------------------------------------------------

## 6.2 Grupos

### R-GROUP-01

Un grupo existe independientemente de una ludoteca.

### R-GROUP-02

Un usuario puede pertenecer a múltiples grupos y un grupo puede tener
múltiples usuarios.

### R-GROUP-03

Los miembros pueden tener roles diferentes.

### R-GROUP-04

Un grupo debe conservar al menos un responsable/propietario.

Si el último propietario desea abandonar el grupo, deberá transferir la
propiedad o resolverse explícitamente el destino del grupo.

------------------------------------------------------------------------

## 6.3 Ludotecas

### R-COL-01

Una ludoteca puede ser personal o estar vinculada a un grupo.

### R-COL-02

Los miembros autorizados pueden gestionarla según sus permisos.

### R-COL-03

Una ludoteca debe tener al menos un responsable.

### R-COL-04

La visibilidad de una ludoteca no determina quién puede modificarla.

### R-COL-05

Una ludoteca puede marcarse como destinada a venta.

### R-COL-06

Un usuario puede tener o administrar múltiples ludotecas.

### R-COL-07

Al mover una copia a una ludoteca destinada a venta, el sistema debe crear,
si no existe, una publicación en borrador. Precio y moneda pueden completarse
después, pero son obligatorios antes de activar la publicación.

------------------------------------------------------------------------

## 6.4 Copias

### R-COPY-01

Una copia activa pertenece a exactamente una ludoteca en un momento
determinado. Una copia que salió de la posesión administrada no pertenece a
ninguna ludoteca activa, pero conserva su identidad e historial.

### R-COPY-02

Una ludoteca puede contener varias copias del mismo juego.

### R-COPY-03

Mover una copia entre ludotecas no crea una nueva copia.

### R-COPY-04

La copia debe referenciar un juego.

### R-COPY-05

La edición de una copia es opcional.

### R-COPY-06

Los movimientos relevantes de una copia deben poder auditarse.

### R-COPY-07

El ciclo de vida de una copia distingue únicamente entre `ACTIVE` y `EXITED`.
El motivo de salida se registra por separado: venta, trueque, regalo,
donación, pérdida, descarte, daño u otro.

### R-COPY-08

El estado físico de una copia es independiente de su ciclo de vida. Una copia
puede estar dañada y seguir activa, o salir por causa de daño.

### R-COPY-09

Mover una copia debe cerrar su permanencia anterior, actualizar su ludoteca
actual, abrir el nuevo periodo histórico y registrar auditoría dentro de una
misma transacción.

------------------------------------------------------------------------

## 6.5 Adquisiciones

### R-ACQ-01

Una copia puede registrar cómo fue adquirida.

### R-ACQ-02

El precio es opcional.

### R-ACQ-03

Compra, regalo, trueque y otros orígenes deben diferenciarse
conceptualmente.

------------------------------------------------------------------------

## 6.6 Préstamos

### R-LOAN-01

Una copia puede prestarse temporalmente.

### R-LOAN-02

Debe registrarse quién posee temporalmente la copia durante el préstamo.

### R-LOAN-03

Una copia no puede tener dos préstamos activos simultáneamente.

### R-LOAN-04

El préstamo no cambia la propiedad de la copia.

### R-LOAN-05

Una copia con préstamo activo no puede completar venta, trueque, regalo,
donación, descarte, salida ni transferencia. Si se pierde durante el préstamo,
se cierra el préstamo como perdido y la copia sale con motivo `LOST`.

------------------------------------------------------------------------

## 6.7 Ventas

### R-SALE-01

Las copias de una ludoteca de venta pueden tener comportamiento
comercial.

### R-SALE-02

Una publicación de venta y una venta completada son conceptos
diferentes.

### R-SALE-03

Una venta completada debe preservar su transacción histórica.

### R-SALE-04

Cuando sea posible, una venta puede transferir la misma copia hacia la
ludoteca del comprador.

### R-SALE-05

Vender una copia no elimina las partidas históricas relacionadas.

### R-SALE-06

Una venta puede completarse hacia un comprador externo sin cuenta. En ese
caso no existe ludoteca destino, la copia sale del inventario activo y la
transacción histórica se conserva.

------------------------------------------------------------------------

## 6.8 Trueques

### R-TRADE-01

Un intercambio involucra al menos dos partes.

### R-TRADE-02

Puede involucrar una o varias copias por cada parte.

### R-TRADE-03

La transferencia de propiedad solo ocurre cuando el intercambio alcanza
estado COMPLETED.

### R-TRADE-04

Un intercambio cancelado o rechazado no debe transferir propiedad.

------------------------------------------------------------------------

## 6.9 Juegos y ediciones

### R-GAME-01

Game y Game Edition son conceptos diferentes.

### R-GAME-02

Una edición debe pertenecer a un juego.

### R-GAME-03

Editorial, idioma y datos específicos de publicación pertenecen
principalmente a la edición.

### R-GAME-04

Los datos secundarios como personas relacionadas pueden ser opcionales.

### R-GAME-05

Un usuario puede mantener una nota personal sobre un juego sin modificar
su descripción global.

------------------------------------------------------------------------

## 6.10 Juegos privados

### R-GAME-PRIVATE-01

Un usuario puede crear juegos privados.

### R-GAME-PRIVATE-02

Un juego privado puede registrar partidas, estadísticas, recursos y
expansiones privadas.

### R-GAME-PRIVATE-03

Un juego privado no debe aparecer en búsquedas ni catálogo global.

### R-GAME-PRIVATE-04

Un juego privado puede compartirse explícitamente.

### R-GAME-PRIVATE-05

Compartir un juego privado no lo convierte en público.

------------------------------------------------------------------------

## 6.11 Moderación

### R-MOD-01

Cualquier usuario puede proponer contenido de juego para publicación.

### R-MOD-02

El contenido que pretenda entrar al catálogo global debe pasar por el
proceso de moderación definido.

### R-MOD-03

Un moderador puede aprobar, rechazar, marcar duplicados, bloquear o
archivar según permisos.

### R-MOD-04

Un juego duplicado puede permanecer utilizable de manera privada cuando
corresponda.

### R-MOD-05

El sistema debe permitir fusionar/migrar información compatible de un
duplicado hacia el juego oficial.

### R-MOD-06

Contenido inapropiado o inválido puede bloquearse, diferenciándolo de un
simple rechazo editorial o duplicado.

### R-MOD-07

Un juego aprobado para el ámbito global entra en el catálogo global
correspondiente.

------------------------------------------------------------------------

## 6.12 Expansiones

### R-EXP-01

Una expansión se modela como un juego relacionado con otro juego.

### R-EXP-02

Una expansión dependiente requiere el juego base para una partida.

### R-EXP-03

Una expansión marcada como jugable independientemente puede utilizarse
sin juego base.

### R-EXP-04

Una partida puede registrar las expansiones utilizadas.

### R-EXP-05

Archivar una expansión no elimina partidas históricas.

------------------------------------------------------------------------

## 6.13 Partidas

### R-MATCH-01

Toda partida debe asociarse a un juego.

### R-MATCH-02

No es necesario poseer una copia para registrar una partida.

### R-MATCH-03

El número de participantes debe respetar el mínimo y máximo
parametrizado para el juego.

Formalmente:

`game.min_players <= participants <= game.max_players`

### R-MATCH-04

Una partida puede contener usuarios registrados y jugadores invitados.

### R-MATCH-05

Una partida puede almacenar fecha, duración, ubicación, participantes,
resultados, expansiones, estadísticas, imágenes, notas y visibilidad.

### R-MATCH-06

Una partida puede quedar inconclusa.

Una partida inconclusa:

-   cuenta como partida jugada;
-   no requiere ganador;
-   no debe interpretarse como derrota;
-   no debe contaminar estadísticas que requieran resultado final.

### R-MATCH-07

Una partida cancelada/anulada debe distinguirse de una partida
inconclusa.

### R-MATCH-08

Las partidas históricas deben conservarse aunque la copia del juego sea
vendida, intercambiada, movida o eliminada del inventario activo.

### R-MATCH-09

La edición utilizada puede registrarse cuando sea conocida, pero no debe
ser obligatoria salvo que una funcionalidad futura lo requiera.

------------------------------------------------------------------------

## 6.14 Resultados

### R-RESULT-01

No todos los juegos tienen un único ganador.

### R-RESULT-02

El sistema debe soportar ganador único, ranking, equipos, cooperativo,
objetivos, puntuaciones y empates.

### R-RESULT-03

Los resultados deben asociarse a los participantes/equipos y no
reducirse a un único campo `winner_id`.

### R-RESULT-04

Una partida inconclusa no requiere resultados definitivos.

### R-RESULT-05

Los empates son resultados válidos.

### R-RESULT-06

La configuración universal de resultados de un juego debe versionarse. Cada
partida referencia la versión con la que fue registrada.

### R-RESULT-07

Una configuración de resultados ya utilizada no cambia semánticamente. Los
cambios crean una nueva versión y conservan las anteriores para interpretar
correctamente el historial.

------------------------------------------------------------------------

## 6.15 Estadísticas flexibles de partida

### R-STAT-01

Cada juego puede definir estadísticas específicas.

### R-STAT-02

Las partidas pueden registrar valores para esas definiciones.

### R-STAT-03

Las estadísticas avanzadas son opcionales.

### R-STAT-04

No deben crearse columnas universales para todas las posibles
estadísticas de todos los juegos.

### R-STAT-05

Una definición estadística que ya tenga valores registrados no debe cambiar
de tipo o significado. Debe archivarse y reemplazarse por una nueva definición.

------------------------------------------------------------------------

## 6.16 Ratings, reviews y favoritos

### R-RATING-01

Un usuario puede valorar un juego en una escala decimal inclusiva de `1` a
`10`.

### R-RATING-02

Rating y review son independientes.

### R-RATING-03

Los ratings globales deben derivarse de valoraciones elegibles.

### R-RATING-04

Cada usuario puede conservar un único rating por juego y actualizarlo.

### R-REVIEW-01

Las reviews pueden contener texto libre.

### R-REVIEW-02

Las reviews pueden recibir likes/dislikes y comentarios.

### R-REVIEW-03

Cada usuario puede conservar una única review por juego y editarla con el
tiempo.

### R-FAV-01

Un usuario puede marcar juegos como favoritos.

### R-FAV-02

Los favoritos agregados/globales se derivan de relaciones individuales
elegibles.

------------------------------------------------------------------------

## 6.17 Wishlist

### R-WISH-01

Un usuario puede agregar juegos a su wishlist.

### R-WISH-02

La wishlist puede contener prioridad, notas, fecha y precio objetivo.

### R-WISH-03

Wishlist y favoritos son conceptos independientes.

------------------------------------------------------------------------

## 6.18 Compartición

### R-SHARE-01

El contenido privado compatible puede compartirse explícitamente.

### R-SHARE-02

Compartir no cambia automáticamente la visibilidad original.

### R-SHARE-03

El acceso compartido puede conceder permisos específicos.

### R-SHARE-04

Un share puede tener expiración.

### R-SHARE-05

El acceso mediante Share no implica descubribilidad mediante búsqueda
global.

### R-SHARE-06

La amistad no sustituye un Share ni concede acceso privado
automáticamente.

------------------------------------------------------------------------

## 6.19 Estadísticas globales, personales y grupales

### R-STATS-01

Las estadísticas globales solo consideran datos elegibles para el ámbito
global.

### R-STATS-02

Las estadísticas personales pueden considerar información privada
accesible al usuario.

### R-STATS-03

Las estadísticas grupales pueden considerar información del grupo según
permisos.

### R-STATS-04

Compartir contenido privado no hace que sus datos pasen automáticamente
a estadísticas globales.

### R-STATS-05

Las estadísticas históricas deben poder consultarse por periodos.

### R-STATS-06

Cuando sea necesario por rendimiento, podrán utilizarse snapshots,
agregados o vistas materializadas sin reemplazar los datos fuente.

------------------------------------------------------------------------

## 6.20 Recomendaciones

### R-REC-01

Las recomendaciones pueden inferirse de la actividad del usuario.

### R-REC-02

Pueden considerar partidas, frecuencia, recencia, ratings, favoritos,
wishlist, categorías, mecánicas, duración, complejidad y cantidad
habitual de jugadores.

### R-REC-03

El sistema no debe necesitar que el usuario declare manualmente todas
sus preferencias.

### R-REC-04

El contenido privado no debe convertirse en descubrible globalmente como
consecuencia del motor de recomendaciones.

------------------------------------------------------------------------

## 6.21 Calendario

### R-CAL-01

El calendario se deriva de las fechas de las partidas.

### R-CAL-02

Debe permitir navegación por día, mes y año.

### R-CAL-03

Al seleccionar una fecha debe poder consultarse el detalle de las
partidas accesibles de ese día.

### R-CAL-04

Puede existir contexto personal, de ludoteca o de grupo.

### R-CAL-05

Siempre debe respetar las reglas de privacidad y acceso.

------------------------------------------------------------------------

## 6.22 Auditoría

### R-AUDIT-01

Las operaciones importantes deben generar trazabilidad.

### R-AUDIT-02

Debe registrarse actor, acción, entidad, fecha y contexto relevante.

### R-AUDIT-03

Cuando corresponda, deben conservarse valores anteriores y posteriores.

### R-AUDIT-04

El Audit Log no reemplaza el historial de negocio.

### R-AUDIT-05

Las acciones de moderación, movimientos de copias, ventas, trueques,
préstamos, cambios de permisos y merges son candidatas obligatorias para
auditoría.

------------------------------------------------------------------------

## 6.23 Regla transversal de historial

### R-GLOBAL-01

No debe eliminarse automáticamente información histórica relevante
cuando una entidad deje de estar activa.

Archivar un juego, vender una copia, completar un préstamo, cerrar un
intercambio, desactivar un usuario o mover una copia no debe destruir
información necesaria para trazabilidad, estadísticas o reportes.

------------------------------------------------------------------------

# 7. Estados conceptuales

## 7.1 Estado de partida

El modelo definitivo deberá distinguir al menos:

-   COMPLETED --- partida finalizada normalmente;
-   INCOMPLETE --- partida iniciada pero terminada sin alcanzar el
    final;
-   CANCELLED --- partida anulada/cancelada.

Podrán aparecer estados adicionales durante el diseño lógico si existe
una necesidad real.

## 7.2 Estado de propiedad/copia

Conceptualmente pueden contemplarse situaciones como:

-   OWNED;
-   BORROWED;
-   LENT;
-   FOR_SALE;
-   SOLD;
-   TRADED;
-   LOST;
-   PREORDERED.

Debe revisarse posteriormente cuáles representan estado real de la copia
y cuáles se derivan de transacciones activas para evitar duplicidad.

## 7.3 Moderación

-   DRAFT;
-   PENDING_REVIEW;
-   APPROVED;
-   REJECTED;
-   REJECTED_DUPLICATE;
-   BLOCKED;
-   ARCHIVED.

## 7.4 Intercambio

-   PROPOSED;
-   ACCEPTED;
-   REJECTED;
-   CANCELLED;
-   COMPLETED.

------------------------------------------------------------------------

# 8. Relaciones conceptuales principales

``` text
USER N ───── N GROUP
USER N ───── N COLLECTION (mediante membresía/permisos)

GROUP 1 ───── N COLLECTION

COLLECTION 1 ───── N COLLECTION_ITEM

COLLECTION_ITEM N ───── 1 GAME
COLLECTION_ITEM N ───── 0..1 GAME_EDITION

GAME 1 ───── N GAME_EDITION

GAME N ───── N CATEGORY
GAME N ───── N MECHANIC
GAME N ───── N PERSON
GAME N ───── N GAME (mediante GAME_RELATIONSHIP)

GAME 1 ───── N GAME_RESOURCE

GAME 1 ───── N MATCH
MATCH N ───── N PARTICIPANT
MATCH N ───── N EXPANSION

USER N ───── N GAME (mediante RATING)
USER N ───── N GAME (mediante REVIEW)
USER N ───── N GAME (mediante FAVORITE)
USER N ───── N GAME (mediante WISHLIST_ITEM)
USER N ───── N GAME (mediante PERSONAL_GAME_NOTE)

USER N ───── N USER (mediante FOLLOW)

GROUP N ───── N USER (mediante GROUP_MEMBER)

COLLECTION_ITEM 1 ───── N LOAN (históricos)
COLLECTION_ITEM N ───── N TRADE (mediante items de intercambio)
COLLECTION_ITEM 1 ───── N SALE_LISTING / SALE_TRANSACTION (históricos)

GAME / MATCH / otros recursos ───── SHARE

GAME ───── MODERATION
GAME ───── GAME_MERGE
```

Las cardinalidades definitivas deberán validarse durante el ERD lógico.

------------------------------------------------------------------------

# 9. Estadísticas previstas

## 9.1 Usuario

Podrán derivarse, entre otras:

-   partidas jugadas;
-   partidas completadas;
-   partidas inconclusas;
-   victorias;
-   derrotas;
-   empates;
-   win rate;
-   juegos diferentes jugados;
-   juego más jugado;
-   categorías más jugadas;
-   mecánicas más jugadas;
-   duración promedio;
-   jugadores habituales;
-   últimas partidas;
-   último juego;
-   favoritos;
-   actividad mensual/anual.

## 9.2 Juego

-   número de partidas;
-   jugadores;
-   duración real promedio;
-   rating global;
-   reviews;
-   favoritos;
-   popularidad;
-   tendencia;
-   distribución de resultados;
-   estadísticas específicas cuando correspondan.

## 9.3 Ludoteca

-   cantidad de juegos;
-   cantidad de copias;
-   valor de adquisición conocido;
-   valor de venta;
-   juegos nunca jugados;
-   juegos más jugados;
-   categorías predominantes;
-   mecánicas predominantes;
-   complejidad promedio;
-   préstamos;
-   ventas;
-   actividad.

## 9.4 Grupo

-   partidas;
-   juegos más jugados;
-   jugadores más frecuentes;
-   resultados;
-   ratings del grupo;
-   categorías favoritas;
-   mecánicas favoritas;
-   actividad por periodo.

## 9.5 Venta

Para ludotecas destinadas a venta:

-   copias disponibles;
-   copias vendidas;
-   ingresos;
-   precio promedio;
-   tiempo promedio hasta venta;
-   historial de ventas.

------------------------------------------------------------------------

# 10. Casos de uso representativos

## 10.1 Dos copias del mismo juego

Santiago posee dos copias de Catan.

-   Catan #1 → Ludoteca Personal.
-   Catan #2 → Ludoteca Venta.

Ambas referencias apuntan al mismo Game, pero son copias diferentes y
pueden tener distinta edición, estado, adquisición y destino.

## 10.2 Juego privado

Un usuario crea **La Guerra de las Arepas**.

Puede:

-   añadir descripción;
-   registrar reglas;
-   crear expansiones privadas;
-   registrar partidas;
-   registrar jugadores;
-   calcular estadísticas;
-   compartir el juego.

No aparece en búsqueda global.

## 10.3 Juego privado compartido con una editorial

El creador comparte **La Guerra de las Arepas** con otra persona o
potencial editorial.

El receptor puede acceder mediante el mecanismo Share.

El juego continúa siendo privado y no aparece en catálogo ni búsquedas
globales.

## 10.4 Juego duplicado

Un usuario crea Catan sin saber que ya existe.

Registra partidas antes de la moderación.

El moderador identifica el duplicado.

El sistema debe permitir vincular/migrar información compatible hacia el
Catan oficial sin perder el historial.

## 10.5 Partida inconclusa

Cuatro personas comienzan una partida.

Después de dos horas deben detenerla porque es demasiado tarde.

Se registra:

-   participantes;
-   duración;
-   juego;
-   estadísticas disponibles;
-   estado INCOMPLETE.

No se registra ganador obligatorio.

La partida cuenta como jugada, pero no como victoria o derrota.

## 10.6 Juego jugado sin poseerlo

Un usuario juega un título en una tienda.

Puede registrar la partida aunque ninguna de sus ludotecas contenga una
copia del juego.

## 10.7 Trueque

Usuario A entrega Catan y recibe Azul de Usuario B.

Cuando el intercambio se completa, las copias cambian de
ludoteca/propietario.

El historial previo de cada copia y las partidas permanecen intactos.

## 10.8 Recomendación

Un usuario juega repetidamente títulos de Hidden Roles y Social
Deduction.

El sistema detecta esa afinidad y puede recomendar otros juegos
compatibles con esas mecánicas y su comportamiento de juego.

------------------------------------------------------------------------

# 11. Decisiones técnicas confirmadas y pendientes

Ya se confirmó PostgreSQL como motor, UUID para entidades principales y un
ERD lógico con tipos, nombres físicos, claves, restricciones e índices
iniciales. Todavía deben cerrarse decisiones de implementación como:

-   estrategia definitiva de migraciones;
-   política de archivo y eliminación por entidad;
-   posible particionamiento cuando exista volumen real que lo justifique;
-   estrategia de almacenamiento de imágenes;
-   almacenamiento de archivos;
-   autenticación;
-   autorización técnica;
-   arquitectura backend;
-   APIs;
-   sistema de búsqueda;
-   implementación del motor de recomendaciones;
-   implementación de estadísticas en tiempo real;
-   estrategia de caché;
-   implementación de servicios para estadísticas flexibles y scoring;
-   identificadores ISBN/SKU/UPC;
-   internacionalización técnica;
-   sistema de notificaciones.

Estas decisiones se abordarán al diseñar la arquitectura y construir las
primeras migraciones productivas.

------------------------------------------------------------------------

# 12. Próximas fases de diseño

El proceso acordado es:

1.  **Diccionario de conceptos** --- completado para el baseline.
2.  **Relaciones y cardinalidades** --- completadas en el ERD lógico.
3.  **Reglas de negocio** --- baseline v1.1.
4.  **Revisión de consistencia del dominio** --- completada inicialmente.
5.  **Modelo conceptual y ERD lógico** --- baseline v1.1.
6.  **Arquitectura de aplicación y APIs** --- siguiente fase.
7.  **Modelo físico y migraciones iniciales.**
8.  **Implementación incremental.**

------------------------------------------------------------------------

# 13. Criterios permanentes de consistencia

Durante la evolución del ERD y la implementación se deberá comprobar:

-   que cada regla pueda representarse en el modelo;
-   que no existan conceptos duplicados;
-   que ownership y permisos no estén mezclados;
-   que privacidad y acceso compartido sean independientes;
-   que el historial sobreviva a ventas, movimientos y trueques;
-   que una partida pueda existir sin una copia;
-   que una copia pueda existir sin edición conocida;
-   que los jugadores invitados funcionen correctamente;
-   que los juegos privados nunca se filtren al catálogo global;
-   que un Share no convierta contenido privado en público;
-   que los merges no destruyan historial;
-   que las expansiones dependientes validen el juego base;
-   que los empates, cooperativos y partidas inconclusas puedan
    representarse;
-   que las estadísticas flexibles no obliguen a modificar el esquema
    por cada juego;
-   que las estadísticas globales no se contaminen con información
    privada;
-   que los permisos de grupos y ludotecas sean consistentes;
-   que Audit Log y las entidades históricas de negocio tengan
    responsabilidades separadas.

------------------------------------------------------------------------

# 14. Resumen del núcleo del dominio

La relación principal puede resumirse como:

``` text
Usuario / Grupo
       │
       ▼
    Ludoteca
       │
       ▼
      Copia
       │
       ▼
      Juego
       │
 ┌─────┼─────────────┐
 ▼     ▼             ▼
Edición Mecánicas Categorías
       │
       ▼
     Partida
       │
 ┌─────┼──────────┐
 ▼     ▼          ▼
Jugadores Resultados Estadísticas
```

Alrededor de este núcleo existen:

``` text
Ratings
Reviews
Favoritos
Wishlist
Follow
Grupos
Compartir
Préstamos
Ventas
Trueques
Moderación
Recomendaciones
Calendario
Auditoría
```

El principio central del proyecto es que **el sistema debe representar
la experiencia real de poseer y jugar juegos de mesa sin confundir el
catálogo global con la información privada de cada usuario**.

------------------------------------------------------------------------

## 15. Estado actual

Este documento representa el **primer baseline funcional del dominio**.

No debe considerarse todavía el esquema definitivo de base de datos. Su
función es servir como fuente de verdad funcional durante la revisión
del dominio y como entrada para construir posteriormente el ERD lógico,
las reglas de integridad y el modelo físico.

Cualquier cambio importante en conceptos o reglas de negocio deberá
reflejarse primero aquí antes de modificar el diseño de base de datos.
