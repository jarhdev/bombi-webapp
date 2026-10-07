# Prompt corregido: Webapp de control de Bombi

Versión revisada del prompt original (`docs/prompt-original.md`) con las decisiones tomadas el 6 oct 2026. Donde este documento y el original no coinciden, manda este.

## Cambios respecto al original

| # | Tema | Decisión |
|---|---|---|
| 1 | Aprobar usuarios nuevos | El aviso al admin por Telegram lleva un botón que **abre la Mini App** en Ajustes → Usuarios. La aprobación se hace dentro de la app. **No** se usan botones con `callback_data`, porque esa respuesta llegaría al webhook del bot actual y lo rompería. |
| 2 | Exponer n8n | Hoy n8n recibe Telegram por `WEBHOOK_URL` vía Tailscale. La webapp usa esa misma URL pública de n8n. No se cambia `WEBHOOK_URL` hasta la migración a un servidor 24/7 (ver `docs/GUIA.md`). |
| 3 | PIN | Se mantiene el PIN de 4–6 dígitos. Se guarda con hash + sal (SHA-256), nunca en texto plano. |
| 4 | Bloqueo por intentos | Nuevas columnas en Usuarios: `intentos_fallidos`, `bloqueado_hasta`. Tras 5 fallos: bloqueado 10 minutos. |
| 5 | Login PWA | Se queda **nombre + PIN** (son 4 personas con nombres distintos). |
| 6 | Token de sesión | Se mantiene, en su forma más simple: n8n firma un token con un secreto y lo valida en cada endpoint. Sin él, cualquiera que encuentre la URL de un webhook podría leer o escribir en el Sheet. Para no repetir lógica, todos los endpoints llaman al mismo subworkflow "Validar token". |
| 7 | N° de orden | n8n lo asigna **al guardar** (máximo + 1). La app muestra el próximo número como referencia y el definitivo al guardar. |
| 8 | CORS | La app llama a `/api/*` y Netlify lo reenvía a n8n (proxy). No hay CORS y la URL de n8n no queda en el código del navegador. |
| 9 | Por cobrar | Las órdenes se registran **siempre en $**. Al cobrar en Bs se usa la tasa del día del pago. Se agregan columnas al final (abajo). El capture se adjunta al cobrar, no al crear la orden. |
| 10 | Filas del bot en Bs sin tasa | Para el resumen en $ se usa la tasa de la hoja Tasas vigente en la fecha de esa fila. |
| 11 | Tasa BCV | Se guarda la **fecha valor** que publica el BCV (la tasa de un viernes en la tarde rige el lunes). A cada registro se le aplica la tasa cuya fecha valor sea ≤ su fecha. La página del BCV queda como respaldo, sabiendo que su certificado SSL suele dar error. |
| 12 | Zona horaria y periodos | Todo se calcula en **America/Caracas**. "Semana" = lunes a domingo. "Mes" = mes calendario. |

## Mejoras adoptadas

- **Referencia repetida:** antes de guardar una venta, un gasto o un cobro, n8n busca la referencia en Ventas y Gastos (incluye filas del bot). Si ya existe, la app avisa y pide confirmar.
- **Doble toque:** el botón Guardar se desactiva mientras guarda, y cada envío lleva un `request_id` único. n8n descarta un `request_id` ya procesado.
- **Anular (solo admin):** desde "Últimos registros". La fila no se borra: se marca `anulado = sí` y deja de contar en los totales.
- **Moneda y tasa visibles** en Venta y Gasto, con el equivalente en $ y la opción de usar otra tasa solo en ese registro.
- **NY Cookies:** dos selectores −/+ por fila (100g y 160g).
- **Privacidad:** con Gemini en el nivel gratis, Google puede usar los captures enviados. Se acepta por ahora.
- **Frontend:** React + Vite, CSS propio con variables y `vite-plugin-pwa`.
- **Cobro con monto distinto:** al cobrar, la app compara el monto pagado (convertido a $) con la orden y avisa si no coincide.

## Columnas del Google Sheets (archivo `Bombi_Control_Ventas`)

Revisadas el 7 oct 2026 con el export del bot y capturas de la hoja. `sheets/preparar-sheet.gs` agrega todo lo nuevo de esta sección. Regla: las columnas existentes no se tocan; lo nuevo va **al final**. Las columnas que el bot no conoce quedan vacías en sus filas (el bot guarda con "Map automatically" e ignora lo que sobra), así que agregarlas no lo rompe.

**Valores compartidos con el bot** (la app usa exactamente estos):
- Moneda: `Bs` o `USD`.
- Método: `Pago Móvil`, `Transferencia`, `Punto de venta`, `Efectivo Bs`, `Efectivo USD`, `Zelle`, `Binance`.
- Categoría de gasto: `Ingredientes`, `Empaques`, `Delivery`, `Servicios`, `Equipos`, `Publicidad`, `Otros`.
- ID: `V-yyMMdd-HHmmss` (ventas) y `G-yyMMdd-HHmmss` (gastos), en hora de Caracas.
- Referencia: se guarda con apóstrofo delante (`'0627…`) para que la hoja no borre los ceros a la izquierda.

**Ventas** (actuales): `ID`, `Fecha`, `Hora`, `Producto`, `Cantidad`, `Monto`, `Moneda`, `Tasa BCV`, `Monto USD`, `Monto Bs`, `Método`, `Banco`, `Referencia`, `Cliente`, `Registrado por`.
Nuevas al final: `Orden`, `Origen` (bot/webapp), `Link capture`, `Anulado`, `Request id`.
La app escribe en `Producto` el texto legible (`2x NY Nutella 160g, 1x Brownie 150g`) y en `Cantidad` el total de unidades.

**Gastos** (actuales): `ID`, `Fecha`, `Hora`, `Concepto`, `Categoría`, `Monto`, `Moneda`, `Tasa BCV`, `Monto USD`, `Monto Bs`, `Método`, `Proveedor`, `Referencia`, `Registrado por`.
Nuevas al final: `Origen`, `Link capture`, `Anulado`, `Request id`.

**Por cobrar** (actuales): `Orden`, `Fecha entrega`, `Cliente`, `Productos`, `Monto`, `Moneda`, `Fecha esperada pago`, `Estado`, `Fecha pago`, `Metodo de pago`, `Referencia`.
Nuevas al final: `Registrado por`, `Origen`, `Moneda pago`, `Monto pagado`, `Tasa pago`, `Monto pagado USD`, `Link capture`.
`Estado`: `pendiente`, `pagado` (los del bot) y `anulada`. Las órdenes de la app van en `USD`; las del bot hoy se crean en `Bs` y la app las acepta igual.

**Pestañas del bot que la app no toca:** `Resumen`, `Pendientes` (cola de confirmación del bot), `Bot` (totales para /resumen), `Listas`.

**Pestañas nuevas:**
- **Productos:** `id`, `Nombre`, `Categoría`, `Presentación`, `Precio USD`, `Activo` (sí/no).
- **Usuarios:** `id`, `nombre`, `telegram_id`, `pin_hash`, `pin_sal`, `rol` (admin/usuario), `estado` (activo/pendiente/inactivo), `fecha_creacion`, `intentos_fallidos`, `bloqueado_hasta`.
  Usuarios iniciales: **Jose** y **Laura** (admin), **Victor** y **Paola** (usuario). `pin_hash` = SHA-256 en hexadecimal de `pin_sal + ":" + pin`.
- **Tasas:** `Fecha valor`, `Tasa`, `Fuente`, `Consultada`. No se duplica si no cambian la tasa ni la fecha valor.

## Contrato de los endpoints (n8n)

La app llama a `/api/<ruta>`; Netlify lo reenvía a `<N8N_API_URL>/<ruta>` (todas son `POST`). Todas las rutas, menos `auth`, exigen `Authorization: Bearer <token>`. Una respuesta de error es `{ ok: false, error: "mensaje" }` con su código HTTP.

| Ruta (POST) | Envía | Responde |
|---|---|---|
| `auth` | `{ initData }` o `{ nombre, pin }` | `{ estado, usuario: {id, nombre, rol}, token, expira }` |
| `resumen` | `{ periodo: hoy\|semana\|mes }` | `{ desde, hasta, ventas_usd, gastos_usd, ganancia_usd, por_cobrar: {cantidad, total_usd}, ultimos: [...5], tasa }` |
| `tasa` | — | `{ tasa, fecha_valor, fuente, consultada }` |
| `tasa-actualizar` (admin) | — | igual que `tasa` + `sin_cambios` |
| `leer-capture` | multipart `capture` | `{ monto, moneda, referencia, fecha, metodo, banco }` |
| `registro` | multipart `data` (JSON) + `capture` opcional | `{ ok, id }` u `{ ok, orden }`; `409 { duplicado }` si la referencia existe |
| `por-cobrar` | — | `{ ordenes: [{..., monto_usd, pagado_usd, saldo_usd}], total_usd (saldo), hay_bs, proximo_numero }` |
| `cobrar` | multipart `data` + `capture` | `{ ok, id, cerrada, pagado_usd, saldo_usd }`; `409 { duplicado }`. Cada cobro es un abono: la orden se cierra cuando lo cobrado cubre el monto (±$0,50). |
| `anular` (admin) | `{ tipo, id }` | `{ ok }` |
| `productos` / `productos-guardar` (admin) | — / `{ productos: [...] }` | `{ productos }` / `{ ok }` |
| `usuarios` / `usuarios-accion` (admin) | — / `{ accion: crear\|aprobar\|activar\|desactivar\|cambiar_pin\|cambiar_rol, ... }` | `{ usuarios }` / `{ ok }` |

El modo demo (`web/src/mocks/mockApi.js`) implementa exactamente este contrato y sirve de referencia para los workflows.

## Fases

1. **Respaldo** ✅: export del bot en `n8n/backup/` y columnas revisadas (ver `docs/FASE1.md`).
2. **Frontend con datos falsos** ✅.
3. **n8n** ✅: workflows `Bombi · API webapp` y `Bombi · Tasa BCV` activos (ver `n8n/README.md`). Falta: prueba del bot con las columnas nuevas.
4. **Captures con Gemini + Drive** 🟡: implementado; falta la prueba con un capture real (lectura de Gemini y archivo en la carpeta `Bombi-webapp-captures`).
5. Botón de la Mini App en BotFather; prueba con usuarios reales.
6. **PWA + deploy en Netlify** 🟡: publicada en https://bombi-control.netlify.app (se publica sola desde la rama). Falta la guía final.

El resto del prompt original (contexto, catálogo, pantallas, diseño visual) sigue vigente.
