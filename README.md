# 🏳️‍⚧️ Traviatita-tan

Bot de Discord para el servidor de <a href="https://discord.gg/zVAC3NBz43">Operación Traviata</a>: recordatorios de hormonas, contador de días de HRT, seguimiento de stock de estradiol, cuenta de días sin quilombos, tiradas de dados y gestión del rol traviatense.

<br>

## 📋 Requisitos

- 🟢 **Node.js 18** o superior.
- 🤖 Un bot de Discord con los intents **Guilds** y **GuildMembers** habilitados.
- 🛡️ Permisos de **Gestionar roles**, **Gestionar canales**, **Enviar mensajes**, **Insertar enlaces** y **Leer historial de mensajes** en los canales de anuncios.
- 🔺 El rol del bot debe estar por encima de los roles que asigna.

<br>

## 🚀 Instalación

```bash
npm install
cp .env.example .env
# completar .env con el token, roles, canales y GUILD_ID del servidor
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

| Variable                       | Obligatoria | Descripción                                                                                      |
| ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------ |
| `TOKEN`                        | ✅ Sí       | Token del bot de Discord.                                                                        |
| `GUILD_ID`                     | ➖ No       | Servidor donde se registran los comandos (actualización instantánea). Si no se define, se registran globalmente. |
| `STATE_DIR`                    | ➖ No       | Carpeta donde se guardan los JSON de estado. Si no se define, se usa el directorio del proyecto. |
| `ROLE_TRAVIATENSE_ID`          | ✅ Sí       | Rol que asigna `/travestir` y que reciben los nuevos miembros.                                   |
| `ROLE_BOT_ID`                  | ✅ Sí       | Rol de bots, excluido de `/travestir`.                                                           |
| `ROLE_500KG_ID`                | ✅ Sí       | Rol 500kg que se menciona en las solicitudes de verificación y puede gestionarlas.                |
| `ROLE_200KG_ID`                | ✅ Sí       | Rol autorizado para usar `/travestir`, `/verificar`, `/enjaular` y `/cuckear`.                   |
| `ROLE_120KG_ID`                | ✅ Sí       | Rol 120kg que se lista en los roles del staff dentro de `/stats`.                                 |
| `ROLE_VERIFICADE_ID`           | ✅ Sí       | Rol que asignan `/verificar` y las solicitudes aceptadas, y que da acceso a los canales NSFW.    |
| `ROLE_PRESO_ID`                | ✅ Sí       | Rol que asigna `/enjaular` al quitar los roles traviatense y verificade.                          |
| `ROLE_CUCK_ID`                 | ✅ Sí       | Rol que asigna `/cuckear` al quitar los roles traviatense y verificade.                           |
| `ROLE_OTOKONOKO_ID`            | ✅ Sí       | Rol que se pinguea en los avisos de stock de Otokonoko y al que se suscriben los usuarios.       |
| `ROLE_ASTROVIALS_ID`           | ✅ Sí       | Rol que se pinguea en los avisos de stock de Astrovials y al que se suscriben los usuarios.      |
| `CHANNEL_ANNOUNCE_QUILOMBO_ID` | ✅ Sí       | Canal donde se anuncian los reinicios de la cuenta de quilombo.                                  |
| `CHANNEL_ANNOUNCE_STOCK_ID`    | ✅ Sí       | Canal donde se anuncian los cambios de stock de ambas tiendas.                                   |
| `CHANNEL_GENERAL_ID`           | ✅ Sí       | Canal general donde se publican los anuncios de verificación y castigos.                         |
| `CHANNEL_VERIFICACION_ID`      | ✅ Sí       | Canal donde se publica el panel de verificación y que se menciona en el anuncio de `/verificar`. |
| `CHANNEL_JAULA_ID`             | ✅ Sí       | Canal al que sólo tienen acceso los presos y donde se les da la bienvenida.                      |
| `CATEGORY_ADMIN_ID`            | ✅ Sí       | Categoría admin donde se crean los canales temporales de verificación.                           |
| `TWEET_USER_ID`                | ✅ Sí       | Usuario que recibe por DM el link para twittear en `/traviatweet`.                               |
| `TWEET_CHECK_MINUTES`          | ✅ Sí       | Cada cuántos minutos se revisa `x.com/traviatitatan` mientras haya tweets pendientes.            |
| `STOCK_CHECK_MINUTES`          | ✅ Sí       | Cada cuántos minutos se revisa el stock de Otokonoko y Astrovials.                               |
| `STOCK_SUMMARY_TZ`             | ➖ No       | Zona horaria IANA para los resúmenes de viales ingresados (diario, semanal y mensual). Por defecto `America/Argentina/Buenos_Aires`. |

`.env` es la fuente de verdad: el código no define valores de reemplazo para estas variables. Las únicas excepciones son `STATE_DIR`, `GUILD_ID` y `STOCK_SUMMARY_TZ`, que al no estar definidas usan el directorio del proyecto, el registro global de comandos y `America/Argentina/Buenos_Aires` respectivamente.

La configuración se centraliza en `config.js`, que carga `.env` una sola vez y valida al arrancar que no falte ninguna variable obligatoria, que los roles, canales y usuarios sean IDs de Discord válidos y que `STOCK_CHECK_MINUTES` y `TWEET_CHECK_MINUTES` sean enteros positivos. Si algo no cumple, el proceso falla con un mensaje indicando la variable problemática.

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
| ✅ `/verificar <usuario>` | Verifica a un miembro con el rol verificade y anuncia en el canal general que ya tiene acceso a los canales NSFW (solo rol 200kg). |
| 🔒 `/enjaular <usuario>` | Quita los roles traviatense y verificade, asigna el rol preso, anuncia en general y da la bienvenida en el canal de presos (solo rol 200kg). |
| 🐂 `/cuckear <usuario>` | Quita los roles traviatense y verificade, asigna el rol cuck y anuncia en general que sólo puede ver el servidor (solo rol 200kg). |
| 🐱 `/github`         | Muestra el repositorio de GitHub del proyecto.                                                            |

<br>

## 🪪 Verificación por ticket

El canal configurado en `CHANNEL_VERIFICACION_ID` mantiene un panel con el botón **Verificarme**. Al tocarlo se crea un canal `verificacion-{username}` dentro de `CATEGORY_ADMIN_ID`, visible para quien lo pidió, el owner, los roles 500kg/200kg/120kg y el bot. El mensaje inicial menciona al usuario y a los tres roles del staff.

La solicitud pide una foto de una identificación con la fecha de nacimiento y, en la misma imagen, un papel con el username y el nombre del servidor. El usuario puede cancelarla; el owner y el staff pueden aceptarla o rechazarla. Aceptar asigna el rol verificade y el listener existente publica el anuncio en el canal general. Rechazar o dejar vencer la solicitud avisa por DM y borra el canal.

Un usuario no puede tener más de una solicitud abierta y quienes ya tienen el rol verificade no pueden crear otra. Los tickets vencen a las 48 horas; el mensaje muestra el tiempo restante y la fecha de vencimiento. El bot revisa y borra los vencidos cada 5 minutos, incluso después de un reinicio. El panel también se repone automáticamente si falta. Las verificaciones aceptadas (por ticket, comando o asignación manual), los rechazos, las cancelaciones y los vencimientos quedan en `verificaciones-log.json`, sin publicarse en Discord.

<br>

## 🐦 Publicaciones en X

`/traviatweet` envía por DM al usuario `TWEET_USER_ID` un link de X con el texto precargado. Si el mensaje supera los 260 caracteres, el bot responde con un error efímero y no publica nada. Mientras haya mensajes pendientes, Traviatita revisa `x.com/traviatitatan` cada `TWEET_CHECK_MINUTES` minutos y, cuando encuentra un tweet con el mismo texto, responde al mensaje del canal con el link y menciona a quien usó el comando.

La detección se hace leyendo el HTML público del perfil, sin API key. Si el texto se edita antes de publicar, o si X bloquea la consulta, no hay respuesta automática; los pendientes vencen a los 7 días. Un tweet debe coincidir exactamente con el mensaje (ignorando espacios extra) y haber sido publicado después del comando.

<br>

## 💾 Persistencia

El estado se guarda en archivos JSON (`stock.json`, `astro.json`, `produccion.json`, `resumenes.json`, `hormonas.json`, `dias.json`, `quilombo.json`, `tweets.json`, `miembros.json`, `verificaciones.json`, `verificaciones-log.json`) mediante escrituras atómicas: primero se escribe un `.tmp` y después se renombra, para no corromper el archivo si el proceso se corta. En hosting con redeploy conviene apuntar `STATE_DIR` a un volumen persistente.

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
config.js                Carga y validación centralizada de variables de entorno
deploy-commands.js       Registro de slash commands vía REST
handlers/
  loadCommands.js        Carga dinámica de commands/
  loadEvents.js          Carga dinámica de events/
commands/                Un archivo por slash command ({ data, execute })
interactions/            Handlers de botones y modales por prefijo de customId
events/
  ready.js               Arranque de trackers y listeners
  interactionCreate.js   Router de interacciones y manejo central de errores
ui/
  stockNotify.js         Botones compartidos de suscripción a stock
utils/
  async.js               sleep y singleFlight para tareas concurrentes
  discord.js             Timestamps, canales y anuncios compartidos
  html.js                Decodificación de entidades y HTML a texto
  http.js                User-Agent y fetch con timeout
  interactions.js        Respuestas efímeras y update/reply
  permissions.js         Chequeo de roles del miembro
  time.js                Formato de duraciones
store.js                 Persistencia JSON con escritura atómica
calendario.js            Helpers de fecha y zona horaria para los resúmenes
produccion.js            Histórico diario de viales ingresados por tienda y producto
resumenes.js             Resúmenes diario, semanal y mensual de viales ingresados
otokonoko.js             Tracker de stock de Otokonoko Pharmacy
astrovials.js            Tracker de stock de Astrovials
hormonas.js              Recordatorios de hormonas por DM
dias.js                  Contador de días de HRT
quilombo.js              Contador de días sin quilombos
dado.js                  Tiradas de dados
miembros.js              Seguimiento diario de entradas y salidas de miembros
travestir.js             Asignación del rol traviatense
verificar.js             Asignación del rol verificade y anuncio en el canal general
verificaciones.js        Panel, tickets temporales, vencimiento y logs de verificación
tweets.js                Detección de tweets publicados y respuesta en el canal
```

---

<br>

Hecho con 💖 para la owner más linda de Discord
