# Bombi Control

Webapp interna de Bombi para registrar **ventas, gastos y cuentas por cobrar**, con lectura del capture de pago por IA. Funciona como Telegram Mini App y como PWA instalable. El backend son webhooks de n8n que escriben en el mismo Google Sheets del bot de Telegram; el bot sigue funcionando como respaldo.

- Especificación vigente: [`docs/PROMPT.md`](docs/PROMPT.md)
- Guía paso a paso (Netlify, BotFather, n8n, usuarios): [`docs/GUIA.md`](docs/GUIA.md)
- Workflows de n8n y respaldo del bot: [`n8n/`](n8n/)
- Hallazgos de la Fase 1 (bot y Sheet): [`docs/FASE1.md`](docs/FASE1.md)

## Estado

| Fase | Estado |
|---|---|
| 1. Respaldo de workflows y columnas del Sheet | Listo |
| 2. Frontend con datos de prueba | Listo |
| 3. n8n: auth, usuarios, registros, Sheets | Pendiente |
| 4. Gemini + Drive | Pendiente |
| 5. Mini App en BotFather | Pendiente |
| 6. PWA + deploy final | PWA lista; deploy pendiente |

## Correr en local

Requiere Node 22.

```bash
cd web
npm install
npm run dev        # abre http://localhost:5173 (también desde el celular en la misma red)
npm test           # pruebas de formatos, fechas y productos
npm run build      # build de producción en web/dist
```

En modo demo se entra como **Jose / 1234** (admin) o **Victor / 5678**. Los datos de prueba se guardan solo en ese navegador; "Ajustes → Reiniciar datos de prueba" los restablece.

## Variables de entorno

Copia `web/.env.example` a `web/.env`.

| Variable | Para qué |
|---|---|
| `VITE_USE_MOCKS` | `true` = modo demo con datos de prueba. `false` = usa n8n. |
| `N8N_BASE_URL` | URL pública de n8n, sin `/webhook`. La usan el proxy de Vite (local) y el build de Netlify para reenviar `/api/*`. No llega al navegador. |

Nunca van en el repo ni en el frontend: token del bot, ID del Sheet, API key de Gemini. Esos viven en las credenciales de n8n.

## Estructura

```
web/                  Frontend (React + Vite + vite-plugin-pwa)
  assets/             logo original de Bombi (fuente de los íconos)
  public/             logos e íconos de la PWA (npm run icons los regenera con Python + Pillow)
  scripts/            write-redirects.mjs (proxy /api en Netlify), make-icons.py
  src/api/            cliente de n8n, sesión y errores
  src/mocks/          API de prueba con el mismo contrato que n8n
  src/screens/        Resumen, Registro, PorCobrar, Ajustes (Usuarios, Productos, Tasa), Login
  src/components/     íconos, controles, capture con IA, selector de productos
  src/lib/            formatos Bs/$, fechas en hora de Caracas, compresión de imágenes
  src/telegram/       integración con telegram-web-app.js
sheets/               Apps Script para preparar el Google Sheet (columnas, pestañas, PIN)
n8n/backup/           export de los workflows actuales del bot (sin modificar)
n8n/workflows/        workflows nuevos de la webapp
docs/                 prompt corregido, prompt original y guía
netlify.toml          build de Netlify (base: web)
```
