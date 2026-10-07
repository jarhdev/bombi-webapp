// Convierte las escrituras de "Lógica Bombi" en peticiones a la API de Google Sheets:
// una por pestaña para agregar filas y una sola para actualizar celdas.
// El link del capture todavía no existe: el marcador {{LINK_CAPTURE}} se guarda vacío y
// "Completar link" lo llena después de responder a la app (así Drive nunca la hace esperar).
const MARCA = '{{LINK_CAPTURE}}';
const out = $('Lógica Bombi').first().json;
let sheetId = '';
for (const i of $('Leer config').all()) if (i.json.clave === 'sheet_id' && i.json.valor) sheetId = i.json.valor;
const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;
const filas = {};
for (const e of out.escrituras) if (e.tipo === 'append') (filas[e.hoja] = filas[e.hoja] || []).push(e.fila);
const items = Object.entries(filas).map(([hoja, values]) => ({ json: {
  hoja,
  url: `${base}/${encodeURIComponent(`'${hoja}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
  body: { values: values.map((r) => r.map((v) => (v === MARCA ? '' : v))) },
  columnasLink: values.map((r) => r.indexOf(MARCA)),
} }));
const celdas = out.escrituras.filter((e) => e.tipo === 'update' && e.valor !== MARCA);
if (celdas.length) items.push({ json: { url: `${base}:batchUpdate`, body: {
  valueInputOption: 'USER_ENTERED', data: celdas.map((e) => ({ range: e.rango, values: [[e.valor]] })),
} } });
return items;
