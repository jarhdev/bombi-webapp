// Convierte las escrituras de "Lógica Bombi" en peticiones a la API de Google Sheets:
// una por pestaña para agregar filas y una sola para actualizar celdas.
// Si se subió un capture a Drive, cambia el marcador {{LINK_CAPTURE}} por su link.
const out = $('Lógica Bombi').first().json;
let sheetId = '';
for (const i of $('Leer config').all()) if (i.json.clave === 'sheet_id' && i.json.valor) sheetId = i.json.valor;
let link = '';
try {
  const archivo = $('Subir capture a Drive').first().json;
  if (archivo.id && !archivo.error) link = `https://drive.google.com/file/d/${archivo.id}/view`;
} catch (e) { link = ''; }
const conLink = (v) => (v === '{{LINK_CAPTURE}}' ? link : v);
const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;
const filas = {};
for (const e of out.escrituras) if (e.tipo === 'append') (filas[e.hoja] = filas[e.hoja] || []).push(e.fila.map(conLink));
const items = Object.entries(filas).map(([hoja, values]) => ({ json: {
  url: `${base}/${encodeURIComponent(`'${hoja}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
  body: { values },
} }));
const celdas = out.escrituras.filter((e) => e.tipo === 'update');
if (celdas.length) items.push({ json: { url: `${base}:batchUpdate`, body: {
  valueInputOption: 'USER_ENTERED', data: celdas.map((e) => ({ range: e.rango, values: [[conLink(e.valor)]] })),
} } });
return items;
