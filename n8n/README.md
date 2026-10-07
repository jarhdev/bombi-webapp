# n8n

- `backup/`: copia JSON del workflow del bot, **sin modificar** (ID del Sheet y lista de permitidos redactados).
- `src/`: código de los nodos Code de los workflows de la webapp. `logica.js` es el corazón de la API y se prueba con `node --test src/logica.test.mjs` (el fixture tiene datos anonimizados).
- `build/`: scripts que arman el código del Workflow SDK (`tasa.sdk.ts`, `api.sdk.ts`) incrustando el código de `src/`. Si cambias `src/`, corre `node build/api.mjs` y vuelve a aplicar el workflow.

Los workflows del bot no se modifican, ni se agrega otro Telegram Trigger para el mismo bot.

## Workflows de la webapp

| Workflow | ID | Qué hace |
|---|---|---|
| Bombi · API webapp | `fjAvdG85JQ0KEY86` | Webhook `POST /webhook/965c5b23-db71-4888-825a-09d1943686ab/bombi/:ruta`. Lee config + todas las pestañas en una llamada, valida la sesión, escribe en el Sheet, responde y avisa por Telegram. |
| Bombi · Tasa BCV | `xuEUEqwpQBMaOp6w` | 8:35 y 16:35 (Caracas) y a pedido de la API. dolarapi → página BCV → última guardada + aviso a admins. Agrega fila en `Tasas` solo si cambió. |

Para tener una copia importable: en n8n, menú del workflow → Download, y guárdala aquí.

## Tabla de datos `bombi_config`

Columnas `clave` / `valor` / `nota`. Nada de esto va en el repo ni en el frontend.

| clave | valor |
|---|---|
| `token_secret` | Secreto para firmar las sesiones (mín. 32 caracteres). Cambiarlo cierra la sesión de todos. |
| `sheet_id` | ID del Google Sheet (el mismo del bot). |
| `telegram_bot_token` | Token del bot; solo se usa para validar la entrada desde la Mini App. Vacío = solo nombre + PIN. |
| `gemini_model` | Modelo para leer captures (`gemini-3.1-flash-lite`). |
| `drive_folder_id` | Carpeta de Drive para guardar captures (Fase 4, pendiente). |

## Credenciales usadas

Google Sheets account (OAuth), Telegram account (el mismo bot, solo para enviar mensajes) y Header Auth account (API key de Gemini).
