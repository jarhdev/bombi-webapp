import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatMonto, parseMonto, toUsd } from './format.js'
import { viernesSiguiente, rangoPeriodo, hoyISO, avisoFechaPago } from './dates.js'
import { textoProductos, totalProductos, agruparCatalogo } from './productos.js'

test('formato de montos', () => {
  assert.equal(formatMonto(1234.56, 'Bs'), 'Bs. 1.234,56')
  assert.equal(formatMonto(12.5, '$'), '$12,50')
  assert.equal(formatMonto(-3, '$'), '−$3,00')
  assert.equal(formatMonto(1234567.8, 'Bs'), 'Bs. 1.234.567,80')
})

test('lectura de montos escritos a mano', () => {
  assert.equal(parseMonto('1.234,56'), 1234.56)
  assert.equal(parseMonto('1234.56'), 1234.56)
  assert.equal(parseMonto('12,5'), 12.5)
  assert.equal(parseMonto('1.234.567'), 1234567)
  assert.equal(parseMonto('Bs. 450'), 450)
  assert.equal(parseMonto('1.234'), 1234)
  assert.equal(parseMonto('0.5'), 0.5)
  assert.equal(parseMonto(''), 0)
})

test('conversión a dólares', () => {
  assert.equal(toUsd(3650, 'Bs', 36.5), 100)
  assert.equal(toUsd(10, '$', 36.5), 10)
  assert.equal(toUsd(10, 'Bs', 0), 0)
})

test('viernes siguiente', () => {
  assert.equal(viernesSiguiente('2026-10-05'), '2026-10-09') // lunes
  assert.equal(viernesSiguiente('2026-10-06'), '2026-10-09') // martes
  assert.equal(viernesSiguiente('2026-10-09'), '2026-10-16') // viernes → el siguiente
  assert.equal(viernesSiguiente('2026-10-10'), '2026-10-16') // sábado
})

test('periodos lunes-domingo y mes', () => {
  assert.deepEqual(rangoPeriodo('semana', '2026-10-06'), ['2026-10-05', '2026-10-11'])
  assert.deepEqual(rangoPeriodo('semana', '2026-10-11'), ['2026-10-05', '2026-10-11'])
  assert.deepEqual(rangoPeriodo('mes', '2026-02-14'), ['2026-02-01', '2026-02-28'])
  assert.deepEqual(rangoPeriodo('hoy', '2026-10-06'), ['2026-10-06', '2026-10-06'])
})

test('hoy en Caracas aunque en UTC ya sea mañana', () => {
  // 2026-10-07 02:00 UTC = 2026-10-06 22:00 en Caracas
  assert.equal(hoyISO(new Date('2026-10-07T02:00:00Z')), '2026-10-06')
})

test('texto y total de productos', () => {
  const prods = [
    { id: 'a', nombre: 'NY Nutella', categoria: 'NY Cookies', presentacion: '160g', precio: 3.5, activo: true },
    { id: 'b', nombre: 'Brownie', categoria: 'Otros', presentacion: '150g', precio: 2.5, activo: true },
    { id: 'c', nombre: 'NY Nutella', categoria: 'NY Cookies', presentacion: '100g', precio: 2.5, activo: true },
  ]
  assert.equal(textoProductos({ a: 2, b: 1 }, prods), '2x NY Nutella 160g, 1x Brownie 150g')
  assert.equal(totalProductos({ a: 2, b: 1 }, prods), 9.5)
  const g = agruparCatalogo(prods)
  assert.equal(g.ny[0].variantes[0].presentacion, '100g')
  assert.equal(g.otros.length, 1)
})

test('aviso de fecha de pago distinta a hoy', () => {
  assert.equal(avisoFechaPago('2026-10-07', '2026-10-07'), null)
  assert.match(avisoFechaPago('2026-10-06', '2026-10-07'), /de ayer \(6 oct\)/)
  assert.match(avisoFechaPago('2026-10-02', '2026-10-07'), /del viernes 2 oct/)
})
