# Prompt: Webapp de control de Bombi (ventas, gastos y cuentas por cobrar)

Eres un desarrollador full-stack. Vas a construir una webapp interna para **Bombi**, un emprendimiento de galletas y brownies en Maracay/Turmero (Venezuela). La usa un grupo pequeño de personas para registrar **ventas, gastos y cuentas por cobrar**, adjuntando el capture del pago. Debe funcionar como **Telegram Mini App** (abierta desde un botón del bot de Telegram que ya existe) y también como **PWA** instalable en el celular.

Antes de escribir código, revisa este documento completo, propón la estructura de carpetas y hazme las preguntas que necesites. Trabaja por fases y muéstrame cada fase funcionando antes de seguir.

---

## 1. Contexto: lo que ya existe

- **Bot de Telegram** ya funcionando, construido en **n8n** (corre en mi laptop; más adelante pasará a un servidor).
- El bot registra ventas en **Google Sheets** y usa **Gemini (nivel gratis)** para leer los captures de pago.
- Ya existe (o se está creando) una pestaña de **cuentas por cobrar** en el mismo Google Sheets.
- Modelo B2B: entregamos a empresas los **lunes/martes** y nos pagan los **viernes**. Cada orden tiene un **número de orden**; cuando llega el pago, el capture se asocia a la orden y esa fila pasa a **Ventas**.
- La mayoría de los pagos son **pago móvil**, pero se necesitan todos los métodos.
- El sitio público de Bombi está en Netlify (bombive.netlify.app); esta webapp es aparte e interna.

---

## 2. REGLA PRINCIPAL: el bot de Telegram sigue funcionando como respaldo

El bot actual es el **backup**. Si la webapp falla, se sigue registrando todo por el bot como hasta ahora. Por eso:

- **No modificar, desactivar ni borrar** los workflows actuales de n8n. Antes de tocar cualquier cosa, **exporta una copia (JSON)** de cada workflow existente.
- Todo lo nuevo va en **workflows nuevos** de n8n (webhooks propios de la webapp).
- **No agregar otro nodo "Telegram Trigger" para el mismo bot**: Telegram solo permite un webhook por bot y eso **rompería el bot actual**. El botón para abrir la Mini App se configura desde **BotFather** (Menu Button), sin tocar los workflows.
- La webapp escribe en **las mismas hojas y con el mismo formato de columnas** que ya usa el bot, para que los datos de ambos canales se mezclen sin problema y los totales sean correctos.
- Si hace falta agregar columnas, agrégalas **solo al final** de cada hoja y verifica que el bot siga escribiendo bien.
- Al terminar cada fase, **prueba el bot** (registrar una venta por Telegram) para confirmar que nada se rompió.

---

## 3. Arquitectura

- **Frontend:** Vite + JavaScript (o React si lo ves más mantenible), mobile-first, sin frameworks de UI pesados. Deploy en **Netlify**.
- **Backend:** **webhooks de n8n** (no crear otro servidor). La webapp solo habla con n8n; n8n habla con Google Sheets, Drive y Gemini.
- **Telegram Mini App:** usar `telegram-web-app.js`, colores de la marca (no los del tema de Telegram), `HapticFeedback` al guardar.
- **PWA:** `manifest.json` (nombre "Bombi Control", colores de marca, íconos), service worker para cachear la app (no los datos).
- **n8n accesible desde internet:** como n8n está en mi laptop, documenta cómo exponerlo de forma segura (por ejemplo Cloudflare Tunnel) y deja la URL base en una variable de entorno (`VITE_N8N_BASE_URL`) para cambiarla fácil cuando migre a servidor.

---

## 4. Usuarios (creación sencilla)

Pestaña **Usuarios** en el mismo Google Sheets: `id`, `nombre`, `telegram_id` (opcional), `pin_hash`, `rol` (admin / usuario), `estado` (activo / pendiente / inactivo), `fecha_creación`.

- **Roles:**
  - **Admin** (Jose y su novia): registra todo, ve el resumen completo, gestiona usuarios y productos.
  - **Usuario**: registra ventas, gastos y órdenes por cobrar, y ve el resumen.
- **Dentro de Telegram:** la primera vez que alguien abre la Mini App, n8n valida su `initData` y busca su `telegram_id`. Si no existe, se crea como **pendiente** y ve "Solicitud enviada, espera aprobación". El admin recibe un aviso y lo aprueba con un toque.
- **Fuera de Telegram (PWA):** login con **nombre + PIN de 4–6 dígitos**. n8n valida el PIN y devuelve un token con expiración (por ejemplo 30 días).
- **Pantalla "Usuarios"** (solo admin, desde el ícono de ajustes): lista de usuarios con su estado, botón "Agregar usuario" (nombre + PIN + rol), y botones para aprobar, desactivar o cambiar PIN.
- Los primeros admins (Jose y su novia) se crean a mano en la hoja; documenta cómo hacerlo.
- Cada registro guarda **quién lo hizo** (columna "registrado por").
- El bot de Telegram mantiene **su propia lista de acceso actual** sin cambios (ver regla principal).

### Seguridad (obligatorio)
- Validar `initData` de Telegram en n8n con HMAC usando el token del bot.
- Guardar los PIN **hasheados**, nunca en texto plano. Bloquear unos minutos tras 5 intentos fallidos.
- Nunca poner el token del bot, el ID del Sheet ni API keys en el frontend ni en el repo. Usar variables de entorno / credenciales de n8n.
- Validar tamaño y tipo de imagen (jpg/png/webp, máx. ~5 MB) y **comprimir en el navegador** antes de subir.

---

## 5. Google Sheets (mismo archivo que usa el bot)

Revisa las columnas actuales antes de cambiar nada y adáptate a ellas. Pestañas:

- **Ventas** (la que ya usa el bot): mantener sus columnas. Si faltan, agregar al final: origen (bot/webapp), registrado por, n° de orden, link del capture.
- **Gastos:** fecha, categoría, descripción, monto, moneda, tasa, monto en $, método de pago, referencia, link del capture, registrado por.
- **Por cobrar:** n° de orden (autoincremental), empresa, productos, monto, moneda, fecha de entrega, fecha de cobro esperada (viernes siguiente por defecto), estado (pendiente/pagada).
- **Productos (catálogo):** nombre, categoría, presentación, precio en $, activo (sí/no). La webapp lee los productos de aquí para poder cambiar menú y precios **sin tocar código**.
- **Usuarios:** ver sección 4.

Los captures se guardan en una carpeta de **Google Drive** y en la hoja va el link.

**Moneda:** los precios del catálogo están en **dólares**. Si el pago es en bolívares (pago móvil, transferencia), registrar el monto en Bs y la **tasa del día** para calcular el equivalente en $. El resumen de ganancias se muestra en $.

### Tasa BCV automática
- Workflow **nuevo** de n8n con **Schedule Trigger** que se ejecuta 2 veces al día (mañana y tarde) y consulta la tasa oficial BCV en `https://ve.dolarapi.com/v1/dolares/oficial` (campo `promedio`; `fechaActualizacion` indica la fecha de la tasa).
- Guardar cada tasa en una pestaña **Tasas**: fecha, tasa, fuente, hora de consulta. Si la tasa no cambió, no duplicar la fila.
- **Respaldo si la API falla:** reintentar; si sigue fallando, intentar leer la tasa desde la página del BCV (bcv.org.ve). Si nada funciona, usar la última tasa guardada y avisar por Telegram al admin.
- En la app: la tasa aparece sola en el formulario y en el Resumen ("Tasa BCV: Bs. X · fecha"). Se puede **editar a mano en un registro puntual** (por ejemplo si el cliente pagó con otra tasa), sin cambiar la tasa del día.
- Cada registro guarda la tasa usada, para que los cálculos viejos no cambien cuando cambia la tasa.
- Endpoint `GET /bombi/tasa` → última tasa guardada.

---

## 6. Catálogo de productos (cargar en la pestaña Productos)

**NY Cookies** (cada sabor en 2 presentaciones):

| Producto | 100g | 160g |
|---|---|---|
| NY Red Velvet | $2.50 | $3.50 |
| NY Milka | $2.50 | $3.50 |
| NY Nutella | $2.50 | $3.50 |
| NY Lemon | $2.50 | $3.50 |
| NY Cri Cri | $2.50 | $3.50 |
| NY Pirulin | $2.50 | $3.50 |

**Otros productos:**

| Producto | Presentación | Precio |
|---|---|---|
| Thin Cookies | 40g | $2.00 |
| Banana Bread | 500g | $4.50 |
| Brownie | 150g | $2.50 |
| Chocochips | Pack de 5 | $2.00 |

**Cómo se ve en el formulario:**
- Agrupado en dos secciones: **NY Cookies** y **Otros**.
- Cada NY Cookie es una fila con el sabor y dos selectores de cantidad −/+: uno para **100g** y otro para **160g** (o un selector 100g/160g por fila; propón el que sea más rápido de usar con una mano).
- Los otros productos tienen un solo selector −/+ con su presentación y precio a la vista.
- El **monto se calcula solo** con los precios del catálogo, pero se puede editar a mano (descuentos, ajustes).
- En la hoja, los productos se guardan como texto legible, por ejemplo: `2x NY Nutella 160g, 1x Brownie 150g`.

---

## 7. Pantallas (ya diseñadas, replicar el diseño)

Tamaño de referencia: celular 390×844. Todos los botones de mínimo 44px de alto.

### 7.1 Resumen (inicio)
- Encabezado: logo circular de Bombi + "Hola, [nombre]" + "Bombi · Control". Ícono de ajustes (usuarios, productos, tasa) a la derecha.
- Selector **Hoy / Semana / Mes**.
- Tarjeta grande en color acento: **Ganancia** del periodo (ventas − gastos) y dos mini tarjetas con **Ventas** y **Gastos**.
- Tarjeta "**Por cobrar**": cantidad de órdenes pendientes y monto total → abre la pantalla Por cobrar.
- Tres botones grandes: **Venta / Gasto / Por cobrar** → abren el formulario con esa pestaña seleccionada.
- **Últimos registros**: los últimos 5 movimientos (punto de color por tipo, descripción, monto con + o −). Incluye los registrados por el bot.

### 7.2 Nuevo registro (formulario)
Pestañas arriba: **Venta / Gasto / Por cobrar**. El formulario cambia según la pestaña:

- **Venta:** adjuntar capture (arriba, zona grande punteada) → monto, fecha (hoy por defecto), cliente, productos con cantidades, método de pago, referencia.
- **Gasto:** adjuntar capture → monto, fecha, categoría (Ingredientes, Empaques, Delivery, Otro), descripción, método de pago, referencia.
- **Por cobrar:** sin capture. Muestra el n° de orden asignado, monto, fecha de cobro, empresa, productos con cantidades.

**Lectura del capture con IA** (reutilizar la misma lógica/prompt de Gemini que ya usa el bot): al adjuntar, mostrar miniatura + "Leyendo capture…"; n8n devuelve `monto`, `referencia`, `fecha`, `banco/método`. Esos campos se **rellenan solos** y se marcan "Leído por IA · revisa los datos". Siempre editables. Si Gemini falla, se llena a mano sin bloquear.

Métodos de pago: Pago móvil, Efectivo, Transferencia, Divisas (fácil agregar más). Moneda: Bs / $.

Botón inferior fijo: "Guardar venta" / "Guardar gasto" / "Guardar orden". Al guardar: confirmación, vibración (en Telegram) y volver al resumen.

### 7.3 Por cobrar
- Tarjeta oscura arriba: **Total pendiente** + "Cobro: Viernes".
- Lista de órdenes pendientes: n° de orden, empresa, día de entrega, productos, monto.
- Cada orden tiene botón "**Marcar pagada + capture**": abre cámara/galería, lee el capture con IA, confirma monto y referencia, y n8n **mueve la orden a Ventas** (estado = pagada, n° de orden guardado en la fila de Ventas).
- Botón inferior: "+ Nueva orden por cobrar".

### 7.4 Ajustes (solo admin)
- **Usuarios** (sección 4).
- **Productos:** activar/desactivar y cambiar precios (escribe en la pestaña Productos).
- **Tasa del día:** ver la tasa BCV automática, su fecha y forzar una actualización manual.

---

## 8. Diseño visual (marca Bombi)

- **Colores:**
  - Fondo crema `#f4e9d6`
  - Tarjetas `#fffaf2`
  - Texto y botones oscuros: marrón `#3b2521`
  - Acento principal (botones de acción, tarjeta de ganancia): carmesí `#6f1425`
  - Rosado pastel `#e29aa5` (detalles, tarjeta por cobrar)
  - Tostado `#c89f74` (bordes de inputs y botones secundarios)
- Colores como variables CSS para poder cambiar el acento fácilmente.
- **Tipografía:** Baloo 2 (Google Fonts), pesos 400–800.
- **Logo:** ilustración line-art de una niña comiendo una galleta, en borgoña sobre crema (te paso el archivo).
- Bordes muy redondeados (tarjetas 20–24px, botones tipo píldora).
- Íconos de línea (stroke) simples, sin emojis.
- Pestañas tipo "segmented control": fondo `#fffaf2`, opción activa en `#3b2521` con texto crema.
- Idioma: **español (Venezuela)**. Formato de montos: `Bs. 1.234,56` y `$12,50`.
- Contraste legible (texto oscuro sobre rosado; texto blanco solo sobre carmesí o marrón).

---

## 9. Endpoints de n8n a crear (workflows NUEVOS)

- `POST /bombi/auth` → valida initData de Telegram o nombre + PIN; devuelve usuario, rol y token.
- `POST /bombi/leer-capture` → recibe imagen, devuelve `{monto, moneda, referencia, fecha, metodo, banco}` usando Gemini.
- `POST /bombi/registro` → tipo (venta/gasto/cobrar), campos y capture opcional; sube capture a Drive y agrega la fila.
- `GET /bombi/resumen?periodo=hoy|semana|mes` → ventas, gastos, ganancia, pendientes, últimos 5 (incluye registros del bot).
- `GET /bombi/productos` y `POST /bombi/productos` (admin).
- `GET /bombi/por-cobrar` y `POST /bombi/cobrar` → n° de orden + capture → mueve a Ventas.
- `GET/POST /bombi/usuarios` (admin) → listar, crear, aprobar, desactivar, cambiar PIN.

Todos los endpoints validan el token y el rol. Entrégame cada workflow como **JSON importable**, con nodos con nombres claros en español y notas explicando cada paso.

---

## 10. Fases

1. **Respaldo:** exportar los workflows actuales de n8n y revisar las columnas del Sheets. Mostrarme qué encontraste.
2. **Frontend con datos falsos:** pantallas navegables, idénticas al diseño, para revisarlas en el celular.
3. **n8n:** auth + usuarios + webhooks + Google Sheets (sin IA aún). Probar que el bot sigue funcionando.
4. **Lectura de captures con Gemini** y subida a Drive. Probar el bot otra vez.
5. **Telegram Mini App:** botón en BotFather que abra la webapp; prueba con usuarios reales.
6. **PWA + deploy en Netlify** + README.

## 11. Entregables

- Código del frontend en un repo con README (cómo correr local, variables de entorno, deploy).
- Workflows nuevos de n8n en JSON + copia de respaldo de los existentes.
- Guía corta en español, paso a paso, para: configurar el botón de la Mini App en BotFather, exponer n8n con túnel, crear el primer admin, agregar usuarios y cambiar productos/precios desde la app o el Sheets.
