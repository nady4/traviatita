# 🏳️‍⚧️ traviatita

Bot de Discord para la comunidad: recordatorios de hormonas, contador de días de HRT, seguimiento de stock de estradiol, cuenta de días sin quilombos, tiradas de dados y gestión del rol traviatense.

## 📋 Requisitos

- 🟢 **Node.js 18** o superior.
- 🤖 Un bot de Discord con los intents **Guilds** y **GuildMembers** habilitados.
- 🛡️ Permisos de **Gestionar roles** (para `/travestir` y las suscripciones de stock), **Enviar mensajes** y **Insertar enlaces** en los canales de anuncios. El rol del bot debe estar por encima de los roles que asigna.

## 🚀 Instalación

```bash
npm install
cp .env.example .env
# completar .env con el token, roles y canales del servidor
npm run deploy   # registra los slash commands
npm start
```

> 📌 `npm run deploy` hay que correrlo al menos una vez y cada vez que cambie la definición de un comando. El bot ya no registra los comandos en cada arranque para evitar llamadas innecesarias a la API de Discord. Los comandos globales pueden tardar hasta una hora en propagarse.

Para desarrollo con recarga automática:

```bash
npm run dev
```

## 🧰 Scripts

| Script | Descripción |
| --- | --- |
| ▶️ `npm start` | Inicia el bot. |
| 🔄 `npm run dev` | Inicia el bot con recarga automática (`node --watch`). |
| ⚡ `npm run deploy` | Registra los slash commands en Discord. |

## 🔐 Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `TOKEN` | ✅ Sí | Token del bot de Discord. |
| `STATE_DIR` | ➖ No | Carpeta donde se guardan los JSON de estado. Si no se define, se usa el directorio del proyecto. |
| `ROLE_TRAVIATENSE_ID` | ✅ Sí | Rol que asigna `/travestir` y que reciben los nuevos miembros. |
| `ROLE_BOT_ID` | ✅ Sí | Rol de bots, excluido de `/travestir`. |
| `ROLE_200KG_ID` | ✅ Sí | Rol autorizado para usar `/travestir` y rol al que se pinguean los avisos de stock. |
| `CHANNEL_ANNOUNCE_QUILOMBO_ID` | ✅ Sí | Canal donde se anuncian los reinicios de la cuenta de quilombo. |
| `CHANNEL_ANNOUNCE_STOCK_ID` | ✅ Sí | Canal donde se anuncian los cambios de stock de ambas tiendas. |
| `STOCK_CHECK_MINUTES` | ✅ Sí | Cada cuántos minutos se revisa el stock de Otokonoko y Astrovials. |

`.env` es la fuente de verdad: el código no define valores de reemplazo para estas variables. La única excepción es `STATE_DIR`, que al no estar definida usa el directorio del proyecto.

La configuración se centraliza en `config.js`, que carga `.env` una sola vez y valida al arrancar que no falte ninguna variable obligatoria, que los roles y canales sean IDs de Discord válidos y que `STOCK_CHECK_MINUTES` sea un entero positivo. Si algo no cumple, el proceso falla con un mensaje indicando la variable problemática.

## 💬 Comandos

| Comando | Descripción |
| --- | --- |
| 💌 `/talk <mensaje>` | El bot repite el mensaje en el canal. |
| 💊 `/otokonoko` | Muestra el stock actual de Otokonoko Pharmacy con botones para suscribirse o desuscribirse de los avisos. |
| 🚀 `/astrovials` | Muestra el stock actual de Astrovials con botones para suscribirse o desuscribirse de los avisos. |
| ⏰ `/hormonas` | Configura recordatorios por DM (12 h, 1 día, 36 h, 5 días, 1 sem, 2 sem o 1 mes). |
| ⏳ `/dias` | Registra la fecha de inicio de HRT y muestra el tiempo transcurrido. |
| 💥 `/quilombo` | Cuenta los días sin quilombos; incluye un botón para reiniciar la cuenta (solo roles autorizados). |
| 🎲 `/dado` | Tira dados d3–d100, un dX personalizado o un número al azar en un rango. |
| 🎭 `/travestir` | Asigna el rol traviatense a todo el servidor, excepto bots (solo rol 200kg). |

## 💾 Persistencia

El estado se guarda en archivos JSON (`stock.json`, `astro.json`, `hormonas.json`, `dias.json`, `quilombo.json`) mediante escrituras atómicas: primero se escribe un `.tmp` y después se renombra, para no corromper el archivo si el proceso se corta. En hosting con redeploy conviene apuntar `STATE_DIR` a un volumen persistente.

## 📦 Seguimiento de stock

Los trackers de Otokonoko y Astrovials revisan los productos cada `STOCK_CHECK_MINUTES` minutos y anuncian solo cuando cambia la disponibilidad. Si el estado guardado tiene más de 30 minutos de antigüedad, los cambios detectados se reconcilian sin anunciar para evitar avisos fantasma después de un reinicio o una restauración. Otokonoko además resuelve el desafío proof-of-work de Anubis antes de consultar la API.

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
store.js                 Persistencia JSON con escritura atómica
otokonoko.js             Tracker de stock de Otokonoko Pharmacy
astrovials.js            Tracker de stock de Astrovials
hormonas.js              Recordatorios de hormonas por DM
dias.js                  Contador de días de HRT
quilombo.js              Contador de días sin quilombos
dado.js                  Tiradas de dados
travestir.js             Asignación del rol traviatense
```

## 📄 Licencia

ISC
