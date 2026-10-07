// Después de responder a la app: con el archivo ya en Drive, arma las celdas "Link capture" a llenar.
// Filas agregadas: la fila real sale de la respuesta de "Escribir en Sheets" (updatedRange).
// Celdas actualizadas (cobro de una orden): el rango ya se conoce.
const MARCA = '{{LINK_CAPTURE}}';
const archivo = $input.first().json;
if (!archivo.id || archivo.error) return [];
const link = `https://drive.google.com/file/d/${archivo.id}/view`;
const letra = (i) => { let s = ''; i += 1; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
const data = [];
const pedidos = $('Separar escrituras').all();
const resultados = $('Escribir en Sheets').all();
pedidos.forEach((p, i) => {
  const cols = p.json.columnasLink || [];
  const m = String(resultados[i]?.json?.updates?.updatedRange || '').match(/![A-Z]+(\d+)/);
  if (!m) return;
  cols.forEach((c, k) => {
    if (c >= 0) data.push({ range: `'${p.json.hoja.replace(/'/g, "''")}'!${letra(c)}${Number(m[1]) + k}`, values: [[link]] });
  });
});
for (const e of $('Lógica Bombi').first().json.escrituras) {
  if (e.tipo === 'update' && e.valor === MARCA) data.push({ range: e.rango, values: [[link]] });
}
if (!data.length) return [];
let sheetId = '';
for (const i of $('Leer config').all()) if (i.json.clave === 'sheet_id' && i.json.valor) sheetId = i.json.valor;
return [{ json: { url: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`,
  body: { valueInputOption: 'USER_ENTERED', data } } }];
