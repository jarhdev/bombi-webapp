// Toma los captures que llegaron con la petición para subirlos a Drive, uno por item.
// Se nombran con el ID del registro (V-…); si se pagó en partes: V-…, V-…-2, V-…-3.
const logica = $('Lógica Bombi').first();
const claves = Object.keys(logica.binary || {});
return claves.map((k, i) => ({
  json: { capture_nombre: i ? `${logica.json.capture_nombre}-${i + 1}` : logica.json.capture_nombre },
  binary: { capture: logica.binary[k] },
}));
