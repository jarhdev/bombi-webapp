// Toma el capture que llegó con la petición para subirlo a Drive con el ID del registro como nombre.
const logica = $('Lógica Bombi').first();
return [{ json: { capture_nombre: logica.json.capture_nombre }, binary: logica.binary }];
