// ===== Envoltorio del nodo Code "Lógica Bombi" =====
const wh = $('API Bombi').first();
const cfg = {};
// Si una clave está repetida, gana la fila con valor (las vacías se ignoran).
for (const i of $('Leer config').all()) if (i.json.valor !== '' && i.json.valor != null) cfg[i.json.clave] = i.json.valor;
const lectura = $('Leer hojas').first().json;
let body = wh.json.body || {};
if (typeof body.data === 'string') { try { body = JSON.parse(body.data); } catch (e) { body = {}; } }
// El capture puede llegar con otro nombre de campo según la versión de n8n: se toma el primer archivo.
const claveArchivo = Object.keys(wh.binary || {})[0];
const salida = procesar({
  ruta: wh.json.params?.ruta || wh.json.query?.ruta, body, headers: wh.json.headers || {}, cfg, lectura,
  errorLectura: !!lectura.error || !Array.isArray(lectura.valueRanges),
  tieneCapture: !!claveArchivo, ahora: new Date(),
});
const item = { json: salida };
if (claveArchivo && (salida.paso === 'capture' || salida.paso === 'escribir')) item.binary = { capture: wh.binary[claveArchivo] };
return [item];
