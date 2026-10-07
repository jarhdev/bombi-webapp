// Convierte las escrituras de "Lógica Bombi" en peticiones a la API de Google Sheets:
// una por pestaña para agregar filas y una sola para actualizar celdas.
const out = $('Lógica Bombi').first().json;
let sheetId = '';
for (const i of $('Leer config').all()) if (i.json.clave === 'sheet_id') sheetId = i.json.valor;
const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;
const filas = {};
for (const e of out.escrituras) if (e.tipo === 'append') (filas[e.hoja] = filas[e.hoja] || []).push(e.fila);
const items = Object.entries(filas).map(([hoja, values]) => ({ json: {
  url: `${base}/${encodeURIComponent(`'${hoja}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
  body: { values },
} }));
const celdas = out.escrituras.filter((e) => e.tipo === 'update');
if (celdas.length) items.push({ json: { url: `${base}:batchUpdate`, body: {
  valueInputOption: 'USER_ENTERED', data: celdas.map((e) => ({ range: e.rango, values: [[e.valor]] })),
} } });
return items;
