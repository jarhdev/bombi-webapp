// Prueba local de "Separar escrituras" + "Completar link" con datos simulados de n8n.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const leer = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const correr = (codigo, nodos, input) => new Function('$', '$input', codigo)((n) => nodos[n], { first: () => input })
const items = (arr) => ({ all: () => arr.map((json) => ({ json })), first: () => ({ json: arr[0] }) })
const logica = { escrituras: [
  { tipo: 'append', hoja: 'Ventas', fila: ['V-1', '2026-10-07', 5, '{{LINK_CAPTURE}}', 'rid'] },
  { tipo: 'update', rango: "'Por cobrar'!H4", valor: 'pagado' },
  { tipo: 'update', rango: "'Por cobrar'!R4", valor: '{{LINK_CAPTURE}}' },
] }
const nodos = { 'Lógica Bombi': items([logica]), 'Leer config': items([{ clave: 'sheet_id', valor: 'S' }]) }
const sep = correr(leer('separar-escrituras.js'), nodos).map((i) => i.json)
assert.deepEqual(sep[0].body.values[0], ['V-1', '2026-10-07', 5, '', 'rid'])
assert.deepEqual(sep[0].columnasLink, [3])
assert.equal(sep[1].body.data.length, 1) // el marcador no se escribe en la primera pasada
nodos['Separar escrituras'] = items(sep)
nodos['Escribir en Sheets'] = items([{ updates: { updatedRange: 'Ventas!A24:E24' } }, { spreadsheetId: 'S' }])
const comp = correr(leer('completar-link.js'), nodos, { json: { id: 'ABC' } })
assert.deepEqual(comp[0].json.body.data.map((d) => d.range), ["'Ventas'!D24", "'Por cobrar'!R4"])
assert.equal(comp[0].json.body.data[0].values[0][0], 'https://drive.google.com/file/d/ABC/view')
assert.equal(correr(leer('completar-link.js'), nodos, { json: { error: 'x' } }).length, 0)
console.log('prueba-link OK')
