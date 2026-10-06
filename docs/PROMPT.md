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

## Columnas del Google Sheets

Regla: las columnas existentes no se tocan; lo nuevo va **al final**.

**Por cobrar** (columnas actuales, creadas por el bot): `Orden`, `Fecha entrega`, `Cliente`, `Productos`, `Monto`, `Moneda`, `Fecha esperada pago`, `Estado`, `Fecha pago`, `Referencia`.
Columnas nuevas al final: `Registrado por`, `Origen`, `Moneda pago`, `Monto pagado`, `Tasa pago`, `Monto pagado $`, `Link capture`.
Valores de `Estado`: `pendiente`, `pagado` (los mismos del bot) y `anulada`.

**Ventas** (pendiente de revisar con el export del bot). Columnas nuevas al final si faltan: `Origen` (bot/webapp), `Registrado por`, `N° orden`, `Link capture`, `Moneda`, `Tasa`, `Monto $`, `Anulado`, `Request id`.

**Gastos** (nueva): `Fecha`, `Categoría`, `Descripción`, `Monto`, `Moneda`, `Tasa`, `Monto $`, `Método de pago`, `Referencia`, `Link capture`, `Registrado por`, `Anulado`, `Request id`.

**Productos** (nueva): `id`, `Nombre`, `Categoría`, `Presentación`, `Precio $`, `Activo` (sí/no).

**Usuarios** (nueva): `id`, `nombre`, `telegram_id`, `pin_hash`, `pin_sal`, `rol` (admin/usuario), `estado` (activo/pendiente/inactivo), `fecha_creacion`, `intentos_fallidos`, `bloqueado_hasta`.

**Tasas** (nueva): `Fecha valor`, `Tasa`, `Fuente`, `Consultada` (fecha y hora). No se duplica si la tasa y la fecha valor no cambian.

## Contrato de los endpoints (n8n)

La app llama a `/api/<ruta>`; Netlify lo reenvía a `<N8N_BASE_URL>/webhook/bombi/<ruta>`. Todas las rutas, menos `auth`, exigen `Authorization: Bearer <token>`. Una respuesta de error es `{ ok: false, error: "mensaje" }` con su código HTTP.

| Método y ruta | Envía | Responde |
|---|---|---|
| `POST auth` | `{ initData }` o `{ nombre, pin }` | `{ estado, usuario: {id, nombre, rol}, token, expira }` |
| `GET resumen?periodo=hoy\|semana\|mes` | — | `{ desde, hasta, ventas_usd, gastos_usd, ganancia_usd, por_cobrar: {cantidad, total_usd}, ultimos: [...5], tasa }` |
| `GET tasa` | — | `{ tasa, fecha_valor, fuente, consultada }` |
| `POST tasa` (admin) | `{ accion: "actualizar" }` | igual que `GET tasa` + `sin_cambios` |
| `POST leer-capture` | multipart `capture` | `{ monto, moneda, referencia, fecha, metodo, banco }` |
| `POST registro` | multipart `data` (JSON) + `capture` opcional | `{ ok, id }` u `{ ok, orden }`; `409 { duplicado }` si la referencia existe |
| `GET por-cobrar` | — | `{ ordenes: [...], total_usd, proximo_numero }` |
| `POST cobrar` | multipart `data` + `capture` | `{ ok }`; `409 { duplicado }` |
| `POST anular` (admin) | `{ tipo, id }` | `{ ok }` |
| `GET productos` / `POST productos` (admin) | `{ productos: [...] }` | `{ productos }` / `{ ok }` |
| `GET usuarios` / `POST usuarios` (admin) | `{ accion: crear\|aprobar\|activar\|desactivar\|cambiar_pin\|cambiar_rol, ... }` | `{ usuarios }` / `{ ok }` |

El modo demo (`web/src/mocks/mockApi.js`) implementa exactamente este contrato y sirve de referencia para los workflows.

## Fases

1. **Respaldo** (lo haces tú): exportar los workflows actuales a `n8n/backup/` y pasar los encabezados de Ventas.
2. **Frontend con datos falsos** ✅ (este commit).
3. n8n: auth + usuarios + webhooks + Google Sheets (sin IA). Probar el bot.
4. Captures con Gemini + Drive. Probar el bot.
5. Botón de la Mini App en BotFather; prueba con usuarios reales.
6. PWA + deploy en Netlify + guía final.

El resto del prompt original (contexto, catálogo, pantallas, diseño visual) sigue vigente.
