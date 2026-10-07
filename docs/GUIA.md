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

## 2. Preparar el Google Sheet

El script `sheets/preparar-sheet.gs` agrega las columnas y pestañas que necesita la webapp. No borra ni mueve nada, y se puede correr más de una vez.

1. Abre **Bombi_Control_Ventas** → **Extensiones → Apps Script**.
2. Borra el contenido de `Código.gs`, pega todo el archivo `sheets/preparar-sheet.gs` y guarda (ícono de disco).
3. Arriba, elige la función **onOpen** y pulsa **Ejecutar**. La primera vez Google pide permisos: **Revisar permisos → tu cuenta → Configuración avanzada → Ir a (no seguro) → Permitir**. Es tu propio script.
4. Vuelve al Sheet y recarga la página. Aparece el menú **Bombi**.
5. **Bombi → 1. Preparar hoja para la webapp.** Al final muestra qué agregó:
   - Ventas: `Origen`, `Link capture`, `Anulado`, `Request id` (`Orden` ya la tenías).
   - Gastos: `Origen`, `Link capture`, `Anulado`, `Request id`.
   - Por cobrar: `Registrado por`, `Origen`, `Moneda pago`, `Monto pagado`, `Tasa pago`, `Monto pagado USD`, `Link capture`.
   - Pestañas nuevas: **Productos** (con el catálogo), **Usuarios** (Jose, Laura, Victor, Paola) y **Tasas**.
6. En la pestaña **Usuarios**, columna `telegram_id`, pega el ID de Telegram de Jose, Laura y Victor. Están en el nodo **Config** del bot, en `PERMITIDOS`. Paola puede quedar vacía; se vincula sola cuando abra la Mini App.
7. **Bombi → 2. Asignar PIN a un usuario**, una vez por persona. En la hoja solo queda el hash, nunca el PIN.
8. **Bombi → 3. Copiar fórmulas.** Crea la pestaña "Fórmulas (copia)". Copia las columnas A y B y pégalas en el chat, para ajustar los totales con la columna `Anulado`. Después borra esa pestaña.
9. Manda una venta de prueba por el bot y confirma que la fila se guarda bien. Las columnas nuevas de esa fila quedan vacías, y es normal.

Si tu tabla tiene un filtro en la fila 1, puede que no incluya las columnas nuevas. Para arreglarlo: **Datos → Quitar filtro** y luego **Crear filtro** de nuevo.

## 3. Pasar del modo demo a n8n (Fase 3)

Cuando estén los workflows de n8n:

1. En Netlify, agrega `N8N_BASE_URL` = la URL pública de n8n (la misma de `WEBHOOK_URL`, sin `/webhook`).
2. Cambia `VITE_USE_MOCKS` a `false` y vuelve a desplegar.

## Próximas secciones

- Agregar usuarios desde la app (Fase 3).
- Botón de la Mini App en BotFather (Fase 5).
- Migrar n8n de la laptop (Tailscale) a un servidor 24/7 sin romper el bot.
- Cambiar productos y precios desde la app o desde el Sheet.
