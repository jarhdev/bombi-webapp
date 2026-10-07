// Respuesta de "Actualizar tasa" a partir del sub-workflow Bombi · Tasa BCV.
const r = $input.first().json;
if (!(Number(r.tasa) > 0)) return [{ json: { status: 503, respuesta: { ok: false, error: 'No pude consultar la tasa ahora. Intenta más tarde.' } } }];
return [{ json: { status: 200, respuesta: r } }];
