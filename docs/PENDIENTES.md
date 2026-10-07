# Estado y próximos pasos

Actualizado: 2026-10-07.

## Funcionando

- App: https://bombi-control.netlify.app (Netlify, rama `claude/eager-gates-68uiiy`, se publica sola con cada push).
- n8n (laptop, expuesto con Tailscale Funnel en `jose-laptop.taila03abc.ts.net`):
  - `Bombi · API webapp` (fjAvdG85JQ0KEY86): activo. Captures → Gemini (principal `gemini-3.5-flash-lite`, respaldo `gemini-3.1-flash-lite`) y Drive.
  - `Bombi · Tasa BCV` (xuEUEqwpQBMaOp6w): activo, 8:35 y 16:35 hora de Caracas.
  - `Bombi · Registro de ventas (Telegram)` (bot): sin cambios.
- Fase 4 confirmada: los captures se guardan en `Bombi-webapp-captures` y su link queda en `Link capture`.

## Mientras n8n siga en la laptop

- La app, el bot y la tasa solo funcionan con la laptop encendida, n8n corriendo y Funnel activo.
- Si la app dice "Error del servidor (502)": revisar `tailscale status` y `tailscale funnel status`; si falta el proxy, `tailscale funnel --bg 5678`.

## Abonos parciales (2026-10-07)

- Una orden se puede pagar en varias partes: cada pago es una venta con el número de orden y su capture.
- La orden sigue pendiente hasta que lo cobrado cubre el monto (±$0,50); Por cobrar y el Resumen muestran el saldo.
- `Monto pagado USD` en Por cobrar = acumulado; las demás columnas de pago guardan el último pago.
- Anular un abono reabre la orden si ya no está cubierta. Una orden con abonos no se puede anular directo.

## Pendientes

0. **Duplicado por Drive lento** (corregido 2026-10-07): ahora se guarda en el Sheet y se responde primero; el capture se sube a Drive después y `Link capture` se completa al terminar. Falta anular el duplicado `V-261007-121401` (Ventas fila 24, sin capture).

1. **Sheet**: en `Por cobrar`, cambiar S1 de `Request_id` a `Request id` (con espacio) para activar la protección contra órdenes duplicadas.
2. **Bot de Telegram**: no recibe mensajes desde el 2026-10-06 16:02. Probable bloqueo temporal de Telegram al registrar el webhook (429 "retry after") mientras Funnel estaba caído. Arreglo: esperar, confirmar Funnel y desactivar/activar el workflow del bot una sola vez. Falta el texto exacto del error.
3. **Migración a Oracle Cloud Always Free** (siguiente sesión). Plan:
   1. Usuario: cuenta Oracle (región fija; Bogotá o São Paulo), pasar a Pay As You Go.
   2. Usuario: crear VM ARM (2 OCPU / 12 GB) con el script de inicio que prepara Claude (Docker + n8n + Tailscale Funnel).
   3. Usuario: detener n8n en la laptop y copiar sus datos al servidor con el comando que prepara Claude (incluye credenciales y `bombi_config`).
   4. Claude: verificar workflows/credenciales/tabla en el n8n nuevo (requiere conector MCP del n8n nuevo).
   5. Claude: actualizar `N8N_API_URL` en Netlify y republicar.
   6. Activar el bot en el servidor (Telegram admite un solo webhook por bot) y probar app, bot, captures y tasa.
   - **Falta del usuario para empezar**: salida de `docker ps --format "{{.Names}} | {{.Image}} | {{.Ports}}"`, `docker inspect <contenedor-n8n> --format "{{json .Mounts}}"` y el `docker-compose.yml` o `docker run` (sin secretos). Auth key de Tailscale (no compartirla en el chat; va directo en el script).
4. **Fase 5**: botón de la Mini App en BotFather y prueba con Laura, Victor y Paola (asignar PIN a Victor y Paola).
5. **Fase 6**: guía final.
