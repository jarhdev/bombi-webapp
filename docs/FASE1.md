# Fase 1: qué encontré en el bot y en el Sheet

Revisado el 7 oct 2026 con el export del workflow "Bombi · Registro de ventas (Telegram)" (37 nodos, activo) y capturas de Ventas, Gastos y Por cobrar.

## Respaldo

`n8n/backup/bot-registro-ventas-telegram.json` es el export del bot **sin modificar**, salvo dos datos que se reemplazaron para no dejarlos en el repo:
- El ID del Google Sheet → `TU_SHEET_ID` (10 apariciones).
- La lista `PERMITIDOS` de IDs de Telegram → vacía.

Guarda el export original completo fuera del repo. Para restaurar desde esta copia, vuelve a poner esos dos datos.

## Cómo funciona hoy el bot

1. **Telegram Trigger** recibe mensajes y toques de botón (`callback_query`). **Config** deja pasar solo los IDs permitidos.
2. **Tipo de mensaje** separa: botón, `/resumen`, texto que empieza con "orden", foto y texto libre.
3. **Foto o texto** → Gemini (`gemini-3.1-flash-lite`) extrae los datos → consulta la tasa en dolarapi → arma la fila → busca la referencia en Ventas → guarda en **Pendientes** → pide confirmación con botones ✅/❌.
4. **Botón ✅** → copia la fila a Ventas o Gastos. Si el capture decía "orden N", marca esa orden como pagada en Por cobrar.
5. **"orden …"** → Gemini lee el texto → número = máximo + 1 → agrega la fila a Por cobrar.
6. **/resumen** → lee la pestaña Bot y responde con los totales de hoy, semana y mes.

Esto confirma la decisión 1: el bot ya usa botones con `callback_data`. Si la webapp mandara botones así, el bot los recibiría y respondería "Esto ya se guardó o descartó antes".

## Lo que la app ya adoptó del bot

- Monedas `Bs` / `USD`, los 7 métodos de pago y las 7 categorías de gasto del bot.
- IDs `V-`/`G-yyMMdd-HHmmss`, columna Hora, y los campos Banco (ventas) y Proveedor (gastos).
- Referencia con apóstrofo delante para conservar los ceros.
- Columnas `Monto USD` y `Monto Bs` llenas igual que el bot.
- Órdenes del bot en Bs, o con monto 0: la app las muestra y las cobra (convierte a $ con la tasa del día).

## Hallazgos para decidir

| # | Hallazgo | Propuesta |
|---|---|---|
| 1 | **Ventas no tiene columna `Orden`.** El bot sí arma ese dato al cobrar una orden, pero se pierde porque la columna no existe. | Agregar `Orden` al final de Ventas. El bot empezará a llenarla solo, sin cambiar nada en n8n. |
| 2 | **Anular vs. fórmulas.** Las pestañas Bot y Resumen suman las filas con fórmulas. Una fila marcada como anulada seguiría contando ahí, y `/resumen` del bot no coincidiría con la app. | Ajustar esas fórmulas para excluir `Anulado = sí`. Necesito ver las fórmulas de Bot y Resumen. |
| 3 | **Órdenes del bot en Bs y con monto 0.** Las dos órdenes de prueba quedaron con Monto 0 y Moneda Bs: el prompt de "Preparar orden" usa Bs por defecto y pone 0 si el mensaje no trae monto. | Opcional (es tocar el bot): cambiar en ese prompt `"moneda":"Bs"` por `"moneda":"USD"`. Solo es texto del prompt. Si prefieres no tocarlo, la app ya maneja ambos casos. |
| 4 | **Orden 2 "pagado" sin fecha ni método de pago.** Tiene referencia, pero `Fecha pago` y `Metodo de pago` están vacíos, aunque el nodo "Marcar orden pagada" sí los llena. | Si esa prueba es anterior a esos campos, no hay nada que hacer. Si fue después, conviene revisar esa ejecución en n8n. |
| 5 | **Fila 2 de Ventas con `#DIV/0!`** en Monto USD (y `-` en la fila 2 de Gastos). | Revisar si es una fila de fórmulas a propósito. La app la ignora al sumar, pero puede afectar fórmulas que sumen la columna completa. |
| 6 | **Mismo número de orden.** El bot y la app calculan el siguiente número igual (máximo + 1). Si los dos crean una orden en el mismo segundo, podrían repetir número. | Aceptable para 4 personas. La app avisa el número final al guardar. |
| 7 | **"Registrado por"** usa el primer nombre de Telegram (Jose, Laura). | Crear los usuarios de la app con esos mismos nombres para que los reportes coincidan. |
| 8 | **Tasa del bot**: el bot usa la tasa del momento en que se confirma, aunque el capture sea de otro día. | Sin cambio. La app usa la tasa de la fecha del registro, editable. Las dos conviven bien. |

## Decisiones (7 oct 2026)

1. `Orden` ya está en Ventas (la agregó Jose).
2. Fórmulas de Bot y Resumen: se sacan con el menú **Bombi → 3. Copiar fórmulas** (`sheets/preparar-sheet.gs`) para ajustarlas con `Anulado`.
3. Órdenes del bot: se quedan como están; la app maneja Bs, USD y monto 0.
4. y 5. Eran pruebas, no hay nada que corregir.
- Usuarios: Jose y Laura (admin), Victor y Paola (usuario).
- Columnas y pestañas nuevas: se agregan con `sheets/preparar-sheet.gs` (ver `docs/GUIA.md`, sección 2).
