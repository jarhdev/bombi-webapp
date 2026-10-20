// ===== Envoltorio del nodo Code "Lógica Bombi" =====
const wh = $('API Bombi').first();
const cfg = {};
// Si una clave está repetida, gana la fila con valor (las vacías se ignoran).
for (const i of $('Leer config').all()) if (i.json.valor !== '' && i.json.valor != null) cfg[i.json.clave] = i.json.valor;
const lectura = $('Leer hojas').first().json;
let body = wh.json.body || {};
if (typeof body.data === 'string') { try { body = JSON.parse(body.data); } catch (e) { body = {}; } }
// Captures: "capture" y, si se pagó en partes, "capture_2", "capture_3"… (en ese orden).
// El nombre del campo puede variar según la versión de n8n, así que se ordenan por el número final.
const nro = (k) => Number((k.match(/(\d+)$/) || [0, 1])[1]);
const archivos = Object.keys(wh.binary || {}).sort((a, b) => nro(a) - nro(b));
const claveArchivo = archivos[0];
const salida = procesar({
  ruta: wh.json.params?.ruta || wh.json.query?.ruta, body, headers: wh.json.headers || {}, cfg, lectura,
  errorLectura: !!lectura.error || !Array.isArray(lectura.valueRanges),
  tieneCapture: !!claveArchivo, ahora: new Date(),
});
const item = { json: salida };
// Para leer con IA basta el primero; para guardar en Drive van todos (capture, capture_2…).
if (claveArchivo && salida.paso === 'capture') item.binary = { capture: wh.binary[claveArchivo] };
if (claveArchivo && salida.paso === 'escribir') {
  item.binary = {};
  archivos.forEach((k, i) => { item.binary[i ? `capture_${i + 1}` : 'capture'] = wh.binary[k]; });
}
return [item];
