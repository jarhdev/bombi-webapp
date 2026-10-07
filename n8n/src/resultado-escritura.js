// Si alguna escritura falló, responde con error; si no, responde lo que calculó "Lógica Bombi".
const out = $('Lógica Bombi').first().json;
const fallo = $input.all().some((i) => i.json.error || !i.json.spreadsheetId);
if (fallo) return [{ json: { status: 502, respuesta: { ok: false, error: 'No se pudo guardar en el Google Sheet. Intenta de nuevo.' }, avisos: [] } }];
return [{ json: { status: out.status, respuesta: out.respuesta, avisos: out.avisos } }];
