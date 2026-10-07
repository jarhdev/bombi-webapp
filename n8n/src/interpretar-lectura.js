// Limpia la respuesta de Gemini y la deja con el formato que espera la app.
const METODOS = ['Pago Móvil', 'Transferencia', 'Punto de venta', 'Efectivo Bs', 'Efectivo USD', 'Zelle', 'Binance'];
const r = $input.first().json;
let raw = (r.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
let d = null;
try { d = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { d = null; }
if (!d || r.error) return [{ json: { status: 502, respuesta: { ok: false, error: 'No pude leer el capture. Llena los datos a mano.' } } }];
const monto = Number(d.monto) || 0;
return [{ json: { status: 200, respuesta: {
  monto: monto > 0 ? Math.round(monto * 100) / 100 : 0,
  moneda: d.moneda === 'USD' ? 'USD' : 'Bs',
  fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : '',
  metodo: METODOS.includes(d.metodo) ? d.metodo : '',
  banco: String(d.banco || '').trim(),
  referencia: String(d.referencia || '').replace(/[^0-9A-Za-z]/g, ''),
} } }];
