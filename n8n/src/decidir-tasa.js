// Decide qué tasa usar: dolarapi -> página del BCV -> última guardada (y avisa a los admins).
const p = (n) => String(n).padStart(2, '0');
const d = new Date(Date.now() - 4 * 3600e3);
const consultada = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
const tomar = (nombre) => { try { return $(nombre).first().json; } catch (e) { return null; } };
let nueva = null;
const api = tomar('Consultar dolarapi');
if (api && Number(api.promedio) > 0) nueva = { tasa: Number(api.promedio), fecha_valor: String(api.fechaActualizacion || '').slice(0, 10), fuente: 'dolarapi (BCV)' };
if (!nueva) {
  const html = String(tomar('Consultar BCV')?.data || '');
  const m = html.match(/id="dolar"[\s\S]*?<strong>\s*([\d.,]+)\s*<\/strong>/);
  const f = html.match(/Fecha Valor:[\s\S]*?content="(\d{4}-\d{2}-\d{2})/);
  if (m) nueva = { tasa: Number(m[1].replace(/\./g, '').replace(',', '.')), fecha_valor: f ? f[1] : consultada.slice(0, 10), fuente: 'bcv.org.ve' };
}
const vr = tomar('Leer tasas y admins')?.valueRanges || [];
const filas = (vr[0]?.values || []).slice(1).filter((r) => Number(r[1]) > 0);
const ult = filas[filas.length - 1];
const serial = (v) => (typeof v === 'number' ? new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5).toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const ultima = ult ? { tasa: Number(ult[1]), fecha_valor: serial(ult[0]), fuente: String(ult[2] || ''), consultada: String(ult[3] || '') } : null;
const usuarios = vr[1]?.values || [];
const enc = (usuarios[0] || []).map(String);
const col = (n) => enc.indexOf(n);
const admins = usuarios.slice(1).filter((r) => r[col('rol')] === 'admin' && r[col('estado')] === 'activo' && String(r[col('telegram_id')] || '').trim()).map((r) => String(r[col('telegram_id')]).trim());
if (!nueva) {
  return [{ json: { accion: 'avisar', avisos: admins.map((chat_id) => ({ chat_id, texto: `No pude consultar la tasa BCV (${consultada}). La app sigue usando la última guardada${ultima ? `: Bs. ${ultima.tasa}` : ''}.` })),
    resultado: ultima ? { ...ultima, sin_cambios: true, aviso: 'No se pudo consultar la tasa nueva.' } : { tasa: 0 } } }];
}
if (ultima && Math.abs(ultima.tasa - nueva.tasa) < 1e-6 && ultima.fecha_valor === nueva.fecha_valor) {
  return [{ json: { accion: 'nada', resultado: { ...ultima, sin_cambios: true } } }];
}
return [{ json: { accion: 'guardar', fila: [nueva.fecha_valor, nueva.tasa, nueva.fuente, "'" + consultada], resultado: { ...nueva, consultada, sin_cambios: false } } }];
