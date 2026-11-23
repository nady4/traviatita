# 🏳️‍⚧️ Traviatita-tan

Bot de Discord para el servidor de <a href="https://discord.gg/zVAC3NBz43">Operación Traviata</a>: recordatorios de hormonas, contador de días de HRT, seguimiento de stock de estradiol, cuenta de días sin quilombos, tiradas de dados y gestión del rol traviatense.

<br>

## 📋 Requisitos

- 🟢 **Node.js 20** o superior.
- 🤖 Un bot de Discord con los intents **Guilds**, **GuildMembers**, **GuildMessages**, **GuildMessageReactions** y **GuildVoiceStates** habilitados, más el intent privilegiado **MessageContent** (necesario para ver el contenido de mensajes editados/eliminados).
- 🛡️ Permisos de **Gestionar roles**, **Gestionar canales**, **Enviar mensajes**, **Adjuntar archivos**, **Insertar enlaces**, **Leer historial de mensajes** y **Añadir reacciones** en los canales de anuncios y en el canal de logs.
- 🔺 El rol del bot debe estar por encima de los roles que asigna.

<br>

## 🚀 Instalación

```bash
npm install
cp .env.example .env
# completar .env con TOKEN, GUILD_ID, TWEET_USER_ID e intervalos; los IDs del servidor están en config/ids.json
npm run deploy   # registra los slash commands
npm start
```

> 📌 `npm run deploy` hay que correrlo al menos una vez y cada vez que cambie la definición de un comando. Con `GUILD_ID` definido, los comandos se registran en ese servidor y se actualizan al instante; además se eliminan los comandos globales para evitar duplicados. Sin `GUILD_ID`, se registran globalmente y pueden tardar hasta una hora en propagarse.

Para desarrollo con recarga automática:

```bash
npm run dev
```

<br>

## 🧰 Scripts

| Script              | Descripción                                            |
| ------------------- | ------------------------------------------------------ |
| ▶️ `npm start`      | Inicia el bot.                                         |
| 🔄 `npm run dev`    | Inicia el bot con recarga automática (`node --watch`). |
| ⏭️ `npm run deploy` | Registra los slash commands en Discord.                |

<br>

## 🔐 Variables de entorno

| Variable                | Obligatoria | Descripción                                                                                      |
| ----------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| `TOKEN`                 | ✅ Sí       | Token del bot de Discord.                                                                        |
| `GUILD_ID`              | ➖ No       | Servidor donde se registran los comandos (actualización instantánea). Si no se define, se registran globalmente. |
| `STATE_DIR`             | ➖ No       | Carpeta donde se guardan los JSON de estado (excepto `data/autoroles.json`). Si no se define, se usa `data/`. |
| `TWEET_USER_ID`         | ✅ Sí       | Usuario que recibe por DM el link para twittear en `/traviatweet`.                               |
| `TWEET_CHECK_MINUTES`   | ✅ Sí       | Cada cuántos minutos se revisa `x.com/traviatitatan` mientras haya tweets pendientes.            |
| `STOCK_CHECK_MINUTES`   | ✅ Sí       | Cada cuántos minutos se revisa el stock de Otokonoko y Astrovials.                               |
| `STOCK_SUMMARY_TZ`      | ➖ No       | Zona horaria IANA para los resúmenes de viales ingresados (diario, semanal y mensual). Por defecto `America/Argentina/Buenos_Aires`. |

Los IDs de canales, roles y emojis están en `config/ids.json`, versionado en el repositorio. Los IDs de los mensajes de autoasignación se guardan en `data/autoroles.json`, que también se versiona. `.env` solo guarda el token, el servidor de comandos, la carpeta de estado, el usuario de Twitter, los intervalos y la zona horaria.

`config/index.js` carga `.env` y `config/ids.json` una sola vez y valida al arrancar que no falte `TOKEN`, `TWEET_USER_ID`, `TWEET_CHECK_MINUTES` ni `STOCK_CHECK_MINUTES`, que `GUILD_ID` y `TWEET_USER_ID` sean IDs de Discord válidos y que los intervalos sean enteros positivos.

<br>

## 💬 Comandos

| Comando              | Descripción                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| 💬 `/talk <mensaje>` | El bot repite el mensaje en el canal.                                                                     |
| 🐦 `/traviatweet <mensaje>` | Repite el mensaje en el canal, envía por DM un link para twittearlo y responde con el link cuando se publica. |
| 💊 `/otokonoko`      | Muestra el stock actual de Otokonoko Pharmacy con botones para suscribirse o desuscribirse de los avisos. |
| 🚀 `/astrovials`     | Muestra el stock actual de Astrovials con botones para suscribirse o desuscribirse de los avisos.         |
| 🔔 `/hormonas`       | Configura recordatorios por DM (12 h, 1 día, 36 h, 5 días, 1 sem, 2 sem o 1 mes).                         |
| ⏳ `/dias`           | Registra la fecha de inicio de HRT y muestra el tiempo transcurrido.                                      |
| 💥 `/quilombo`       | Cuenta los días sin quilombos; incluye un botón para reiniciar la cuenta (solo roles autorizados).        |
| 🎲 `/dado`           | Tira dados d3–d100, un dX personalizado o un número al azar en un rango.                                  |
| 📊 `/stats`          | Muestra miembros, roles, altas y bajas, stock y racha sin quilombos.                                      |
| 🏳️‍⚧️ `/travestir`      | Asigna el rol traviatense a todo el servidor, excepto bots (solo rol 200kg).                              |
| ⬆️ `/ascender <usuario>` | Asciende a un miembro: le da 100kg si no tiene rol, o 150kg si tiene 100kg (solo 200kg/500kg). |
| ⬇️ `/descender <usuario>` | Desciende a un miembro: le da 100kg si tiene 150kg, o le quita el rol si tiene 100kg (solo 200kg/500kg). |
| 🔒 `/enjaular <usuario>` | Quita los roles traviatense y 100kg, asigna el rol preso, anuncia en general y da la bienvenida en el canal de presos (solo rol 200kg). |
| 🔓 `/desenjaular <usuario>` | Quita el rol preso, devuelve el rol traviatense, anuncia en general y se despide en el canal de presos (solo rol 200kg). |
| 🐂 `/cuckear <usuario>` | Quita los roles traviatense y 100kg, asigna el rol cuck y anuncia en general que sólo puede ver el servidor (solo rol 200kg). |
| 🐱 `/github`         | Muestra el repositorio de GitHub del proyecto.                                                            |

<br>

## 👋 Entradas y salidas

Cuando alguien entra al servidor, el bot publica en `config.channels.general` la bienvenida **DENLE LA BIENVENIDA A @usuario!!!!**, debajo un saludo que enlaza el canal de reglas (`config.channels.reglas`) y el de roles (`config.channels.roles`), y más abajo el avatar del usuario recortado en círculo, generado con `@napi-rs/canvas`. Cuando alguien se va, publica `{username} ({name}) se fue del server u.u`, usando el username y el nombre del servidor.

Los anuncios ignoran a los bots y las menciones se envían sin notificar (`allowedMentions: { parse: [] }`). Además de los anuncios, cada entrada y salida suma al seguimiento diario que se muestra en `/stats`.

<br>

## 🎭 Autoasignación de roles por reacción

En el canal `config.channels.roles` el bot publica y mantiene seis mensajes, con los roles de país primero y luego los cuatro grupos:

- 🌎 **Roles de país (1/2)**: Argentina, Bolivia, Brasil, Chile, Colombia, Costa Rica, Cuba, Ecuador, El Salvador, Guatemala, Haití y Honduras.
- 🌎 **Roles de país (2/2)**: México, Nicaragua, Panamá, Paraguay, Perú, Puerto Rico, República Dominicana, Uruguay, Venezuela, España, USA e Israel.
- ☣️ **Elegí que tan chistose sos jijoooooo**: alto riesgo, riesgo medio y bajo riesgo.
- 🎙️ **Roles de notificación**: VC, Juegos, Juntadas, Revivir chat, Bumper y Alianzas.
- 💗 **Roles de identidad**: hombre, mujer, trans, cis, no binarie y repper/pre-hrt.
- 🗣️ **Pronombres**: él, ella, elle, preguntar y no me hablen.

Cada opción se muestra como `emoji - @rol`, con una mención real al rol pero sin notificar. Al lado de cada rol aparece entre paréntesis, y en negrita, la cantidad de miembros que lo tienen. El contador se actualiza cuando alguien suma o pierde el rol, sea por reacción o por cualquier otro medio, y esas ediciones automáticas no se registran en el canal de logs. El bot reacciona con todos los emojis del grupo. Al reaccionar se asigna el rol correspondiente y al quitar la reacción se remueve. El grupo de riesgo es de opción única: al elegir un nivel se quita el anterior; el resto permite acumular roles.

Los IDs de los seis mensajes se guardan en `data/autoroles.json`, fuera de `STATE_DIR`, y se versionan en el repositorio. Si no encuentra un ID, busca el mensaje existente en el canal por título y descripción antes de publicar uno nuevo, así no se duplican al reiniciar ni en la nube. Después del primer arranque, commiteá `data/autoroles.json` para conservar los IDs entre despliegues. El bot no borra ni repostea mensajes para reordenarlos: respeta el orden en que ya están publicados en el canal. Si un mensaje se borra, el bot lo repone una sola vez y actualiza su ID. Las reacciones de bots se ignoran.

<br>

## 📝 Registro de actividad

En el canal `config.channels.logs` el bot registra:

- 🗑️ **Mensajes eliminados**: canal, autor, ID, fecha de creación, contenido y adjuntos.
- ✏️ **Mensajes editados**: canal, autor, ID, fecha de creación, contenido anterior y nuevo.
- 🔊 **Entradas y salidas de canales de voz**, incluyendo movimientos entre canales, con el canal y la cantidad de usuarios.
- 📥 **Entradas y salidas del servidor**, con la fecha de creación de la cuenta, la fecha de ingreso y los roles.

Para mostrar el contenido anterior de un mensaje editado o el contenido de uno eliminado, el bot guarda en memoria los últimos 2000 mensajes. Ese caché no se persiste: los mensajes anteriores al arranque pueden aparecer como sin contenido disponible. Las menciones se envían sin notificar (`allowedMentions: { parse: [] }`) y se excluyen de los logs las ediciones/eliminaciones del propio bot y el mensaje de solicitud de verificación, sin excluir el resto de mensajes de esos canales. Los tiempos se muestran solo en formato relativo.

El contenido de los mensajes requiere el intent privilegiado **Message Content** habilitado en Discord Developer Portal. Sin ese intent el bot no inicia.

<br>

## 🚫 Anti-spam

Cuando une misma persona envía el mismo contenido (texto y adjuntos idénticos) **3 veces en menos de 30 segundos**, el bot borra esos mensajes, le quita los roles traviatense y 100kg, le asigna el rol preso y avisa en `config.channels.staff` con un embed que incluye al usuario, la cantidad de mensajes detectados y eliminados, si quedó enjaulade y el contenido repetido. No se enjaula a la owner, a bots, ni a miembros con un rol igual o superior al del bot.

<br>

## 🪪 Verificación por ticket

El sistema de verificación por ticket está **deshabilitado por defecto** (`VERIFICATION_ENABLED=false`). El código del panel, los tickets temporales, los vencimientos y los logs se conserva en `services/verificaciones.js`, `services/verificar.js` e `interactions/verificacion.js` para poder reactivarlo en el futuro con `VERIFICATION_ENABLED=true`.

<br>

## 🐦 Publicaciones en X

`/traviatweet` envía por DM al usuario `TWEET_USER_ID` un link de X con el texto precargado. Si el mensaje supera los 260 caracteres, el bot responde con un error efímero y no publica nada. Mientras haya mensajes pendientes, Traviatita revisa `x.com/traviatitatan` cada `TWEET_CHECK_MINUTES` minutos y, cuando encuentra un tweet con el mismo texto, responde al mensaje del canal con el link y menciona a quien usó el comando.

La detección se hace leyendo el HTML público del perfil, sin API key. Si el texto se edita antes de publicar, o si X bloquea la consulta, no hay respuesta automática; los pendientes vencen a los 7 días. Un tweet debe coincidir exactamente con el mensaje (ignorando espacios extra) y haber sido publicado después del comando.

<br>

## 💾 Persistencia

El estado se guarda en `data/` (o en `STATE_DIR` si está definido) en archivos JSON (`stock.json`, `astro.json`, `anubis.json`, `produccion.json`, `resumenes.json`, `hormonas.json`, `dias.json`, `quilombo.json`, `tweets.json`, `miembros.json`, `verificaciones.json`, `verificaciones-log.json`) mediante escrituras atómicas: primero se escribe un `.tmp` y después se renombra, para no corromper el archivo si el proceso se corta. `data/autoroles.json` es la excepción: vive en `data/` para poder versionarlo y no usa `STATE_DIR`. Al arrancar, si encuentra JSON viejos en la raíz, los migra automáticamente a `data/`. En hosting con redeploy conviene apuntar `STATE_DIR` a un volumen persistente.

El seguimiento de entradas y salidas de miembros empieza a contar desde que se inicia esta versión del bot; no reconstruye el historial anterior.

<br>

## 📦 Seguimiento de stock

Los trackers de Otokonoko y Astrovials revisan los productos cada `STOCK_CHECK_MINUTES` minutos y anuncian solo cuando cambia la disponibilidad. Si el estado guardado tiene más de 30 minutos de antigüedad, los cambios detectados se reconcilian sin anunciar para evitar avisos fantasma después de un reinicio o una restauración. Otokonoko además resuelve el desafío proof-of-work de Anubis antes de consultar la página de cada producto, de donde extrae la cantidad disponible.

Cada vez que un producto suma unidades, el ingreso se guarda en `produccion.json` con la fecha del día y la cantidad, de modo que el histórico completo queda disponible para análisis. Sobre ese histórico se publican tres resúmenes en el canal de stock, siempre que haya al menos un vial ingresado:

- 🚀 **Diario** (solo Astrovials): al terminar cada día, con el detalle por tipo de vial.
- 📅 **Semanal** (ambas tiendas): al terminar el domingo, con el total de lunes a domingo.
- 🗓️ **Mensual** (ambas tiendas): al terminar el mes, con el total del mes calendario.

Los resúmenes usan la zona horaria `STOCK_SUMMARY_TZ` y registran en `resumenes.json` el último período anunciado para no duplicar mensajes. Si el bot estaba apagado cuando correspondía un resumen, al arrancar recupera el último período pendiente.

Además, `produccion.json` guarda las salidas de stock (`exits`) y la duración de cada período en stock (`inStockSince` y `durations`, con el promedio agrupado por semana). Esta información es solo para análisis interno: no se muestra en Discord.

<br>

## 🗂️ Estructura

```
index.js                 Bootstrap: client, carga de comandos/eventos, login y apagado
deploy-commands.js       Registro de slash commands vía REST
config/
  index.js               Carga de .env y config/ids.json
  ids.json               IDs de canales y roles, más emojis de autoasignación
lib/
  store.js               Persistencia JSON atómica y migración a data/
services/
  produccion.js          Histórico diario de viales ingresados por tienda y producto
  stockTracker.js        Tracker genérico de stock (fetch, anuncios y estado)
  resumenes.js           Resúmenes diario, semanal y mensual de viales ingresados
  otokonoko.js           Tracker de stock de Otokonoko Pharmacy
  astrovials.js          Tracker de stock de Astrovials
  hormonas.js            Recordatorios de hormonas por DM
  dias.js                Contador de días de HRT
  quilombo.js            Contador de días sin quilombos
  dado.js                Tiradas de dados
  miembros.js            Seguimiento diario de entradas/salidas y anuncios de bienvenida/despedida
  autoroles.js           Autoasignación de roles por reacción en el canal de roles
  logs.js                Registro de mensajes, voz y miembros en el canal de logs
  spam.js                Detección de spam repetido, borrado, enjaulamiento y aviso al staff
  travestir.js           Asignación del rol traviatense
  verificar.js           Asignación del rol 100kg y anuncio en el canal general (deshabilitado)
  verificaciones.js      Panel, tickets temporales, vencimiento y logs de verificación (deshabilitado)
  tweets.js              Detección de tweets publicados y respuesta en el canal
data/
  autoroles.json         IDs de los mensajes de autoasignación (versionado)
  *.json                 Estado local (ignorado)
handlers/
  loadCommands.js        Carga dinámica de commands/
  loadEvents.js          Carga dinámica de events/
  loadModules.js         Carga de módulos con validación compartida
commands/                Un archivo por slash command ({ data, execute })
interactions/            Handlers de botones y modales por prefijo de customId
events/
  ready.js               Arranque de trackers y listeners
  interactionCreate.js   Router de interacciones y manejo central de errores
ui/
  stockNotify.js         Botones compartidos de suscripción a stock
utils/
  async.js               sleep y singleFlight para tareas concurrentes
  command.js             Wrapper de comandos (guild, roles y handler)
  punishments.js         Flujo compartido de castigos con roles
  discord.js             Timestamps, canales y anuncios compartidos
  html.js                Decodificación de entidades y HTML a texto
  http.js                User-Agent y fetch con timeout
  interactions.js        Respuestas efímeras y update/reply
  permissions.js         Chequeo de roles del miembro
  time.js                Formato de duraciones y temporizadores periódicos
  calendario.js          Helpers de fecha y zona horaria para los resúmenes
```

---

<br>

Hecho con 💖 para la owner más linda de Discord
