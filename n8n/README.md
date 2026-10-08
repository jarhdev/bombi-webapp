# n8n

- `backup/`: copia JSON del workflow del bot, **sin modificar** (ID del Sheet y lista de permitidos redactados).
- `src/`: código de los nodos Code de los workflows de la webapp. `logica.js` es el corazón de la API y se prueba con `node --test src/logica.test.mjs` (el fixture tiene datos anonimizados).
- `build/`: scripts que arman el código del Workflow SDK (`tasa.sdk.ts`, `api.sdk.ts`) incrustando el código de `src/`. Si cambias `src/`, corre `node build/api.mjs` y vuelve a aplicar el workflow.

Los workflows del bot no se modifican, ni se agrega otro Telegram Trigger para el mismo bot.

## Workflows de la webapp

| Workflow | ID | Qué hace |
|---|---|---|
| Bombi · API webapp | `fjAvdG85JQ0KEY86` | Webhook `POST /webhook/965c5b23-db71-4888-825a-09d1943686ab/bombi/:ruta`. Lee config + todas las pestañas en una llamada, valida la sesión, sube el capture a Drive (si hay), escribe en el Sheet, responde y avisa por Telegram. |
| Bombi · Tasa BCV | `xuEUEqwpQBMaOp6w` | 8:35 y 16:35 (Caracas) y a pedido de la API. dolarapi → página BCV → última guardada + aviso a admins. Agrega fila en `Tasas` solo si cambió. |

Para tener una copia importable: en n8n, menú del workflow → Download, y guárdala aquí.

## Tabla de datos `bombi_config`

Columnas `clave` / `valor` / `nota`. Nada de esto va en el repo ni en el frontend.

| clave | valor |
|---|---|
| `token_secret` | Secreto para firmar las sesiones (mín. 32 caracteres). Cambiarlo cierra la sesión de todos. |
| `sheet_id` | ID del Google Sheet (el mismo del bot). |
| `telegram_bot_token` | Token del bot; solo se usa para validar la entrada desde la Mini App. Vacío = solo nombre + PIN. |
| `gemini_modelo_principal` | Modelo que lee los captures de la webapp (`gemini-3.5-flash-lite`). Un intento de 20 s. |
| `gemini_modelo_respaldo` | Se usa si el principal falla o tarda (`gemini-3.1-flash-lite`). Un intento de 15 s. Así la app recibe respuesta antes de sus 45 s. |
| `gemini_model` | Valor anterior; solo se usa si falta `gemini_modelo_respaldo`. |
| `drive_folder_id` | Carpeta de Drive donde se guardan los captures (`Bombi-webapp-captures`). El archivo se llama como el ID del registro (`V-…`/`G-…`) y su link va en la columna Link capture. Si está vacía, se suben a la raíz de Drive. |

Si una clave aparece dos veces, se usa la fila que tenga valor.

## Credenciales usadas

Google Sheets account (OAuth), Google Drive account (OAuth), Telegram account (el mismo bot, solo para enviar mensajes) y Header Auth account (API key de Gemini).

## Columnas que usa la API

- `Por cobrar` → `Request id` (columna S): evita crear la misma orden dos veces si se toca Guardar dos veces. Si la columna no existe, la orden se guarda igual, sin esa protección.

## Inventario (2026-10-08)

Pestañas nuevas en el Sheet:

- `Inventario`: entradas (galletas sin hornear que se preparan) y ajustes por conteo real. Una fila por producto.
- `Detalle ventas`: una fila por producto de cada venta u orden registrada en la app (`Registro` = ID de la venta u `O-<n>` de la orden). Las filas con `Descuenta inventario = sí` restan del stock; el historial cargado a mano usa `no`.
- `Stock`: fórmulas que calculan el stock de cada producto con `Stock mínimo` (columna G de Productos).
- `Vendidos por semana`: tabla dinámica (QUERY) de `Detalle ventas` por semana (lunes) y producto, sin anulados.

Rutas de la API: `inventario` (stock + vendidos por semana) e `inventario-mover` (`tipo: entrada` para todos, `tipo: conteo` solo admin).
Cuando una venta, orden o conteo hace que un producto baje de su mínimo, se avisa una vez por Telegram a los admins.
El Sheet usa configuración regional es_VE: las fórmulas escritas por API van con punto y coma.
