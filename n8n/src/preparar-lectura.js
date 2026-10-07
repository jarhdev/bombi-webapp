// Arma la petición a Gemini con la imagen del capture (mismo enfoque que el bot).
let modelo = 'gemini-3.1-flash-lite';
for (const i of $('Leer config').all()) if (i.json.clave === 'gemini_model' && i.json.valor) modelo = i.json.valor;
const item = $input.first();
const mime = $('Lógica Bombi').first().binary?.capture?.mimeType || 'image/jpeg';
const d = new Date(Date.now() - 4 * 3600e3);
const hoy = d.toISOString().slice(0, 10);
const sistema = `Eres el asistente de registro de Bombi, un emprendimiento de galletas en Venezuela.
Recibes la captura de un pago (pago móvil, transferencia, punto de venta, Zelle, Binance, etc.) y devuelves SOLO un objeto JSON, sin texto adicional.
Formato exacto:
{"monto":0,"moneda":"Bs|USD","fecha":"YYYY-MM-DD","metodo":"","banco":"","referencia":""}
Reglas:
- Hoy es ${hoy}. Usa la fecha de la captura si se ve; si no, usa hoy.
- monto es un número sin separadores de miles: "1.234,56 Bs" -> 1234.56.
- moneda: "Bs" para bolívares (pago móvil, transferencia y punto de venta casi siempre son Bs); "USD" si dice $, dólares, Zelle o USDT.
- metodo debe ser uno de: Pago Móvil, Transferencia, Efectivo Bs, Efectivo USD, Zelle, Binance, Punto de venta.
- referencia: el número de referencia u operación tal como aparece (solo dígitos y letras), o "".
- banco: banco emisor si se ve (Banesco, Mercantil, Venezuela, Provincial, BNC, etc.), o "".
- No inventes datos: deja "" o 0 si no se ve.`;
return [{ json: { modelo, body: {
  system_instruction: { parts: [{ text: sistema }] },
  contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: item.json.img } }, { text: 'Captura de pago.' }] }],
  generationConfig: { temperature: 0, responseMimeType: 'application/json' },
} } }];
