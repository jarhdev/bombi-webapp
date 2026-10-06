# Guía de Bombi Control

Esta guía crece con cada fase. Por ahora cubre cómo ver la app en el celular (Fase 2).

## 1. Publicar la app en Netlify (modo demo)

1. Entra a [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project → GitHub**.
2. Autoriza a Netlify y elige el repo `jarhdev/bombi-webapp`.
3. Netlify lee `netlify.toml`: carpeta base `web`, comando `npm run build`, publica `dist`. No cambies nada.
4. En **Branch to deploy** elige la rama que quieras revisar (por ahora `claude/eager-gates-68uiiy`; después será `main`).
5. En **Environment variables** agrega `VITE_USE_MOCKS` = `true`.
6. **Deploy**. Abre la URL que te da Netlify (algo como `bombi-control.netlify.app`) en el celular.
7. Para instalarla: en Android, menú ⋮ → **Instalar app**; en iPhone, Compartir → **Agregar a inicio**.

Puedes cambiar el nombre del sitio en **Site configuration → Change site name**.

## 2. Pasar del modo demo a n8n (Fase 3)

Cuando estén los workflows de n8n:

1. En Netlify, agrega `N8N_BASE_URL` = la URL pública de n8n (la misma de `WEBHOOK_URL`, sin `/webhook`).
2. Cambia `VITE_USE_MOCKS` a `false` y vuelve a desplegar.

## Próximas secciones

- Primer admin y agregar usuarios (Fase 3).
- Botón de la Mini App en BotFather (Fase 5).
- Migrar n8n de la laptop (Tailscale) a un servidor 24/7 sin romper el bot.
- Cambiar productos y precios desde la app o desde el Sheet.
