import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const dir = new URL('.', import.meta.url)
const src = ['cripto.js', 'logica.js'].map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n')
const ctxVm = vm.createContext({})
vm.runInContext(src + '\nthis.procesar = procesar; this.hashPin = hashPin; this.sha256 = sha256; this.utf8Bytes = utf8Bytes; this.hex = hex; this.hmac = hmac;', ctxVm)
const { procesar, hashPin, sha256, utf8Bytes, hex, hmac } = ctxVm
const fixture = () => JSON.parse(readFileSync(new URL('fixture-lectura.json', dir), 'utf8'))
const cfg = { token_secret: 'a'.repeat(48), telegram_bot_token: '123:ABC' }
const AHORA = new Date('2026-10-07T15:30:00Z') // 11:30 en Caracas

function conPin(lectura, nombre, pin) {
  const U = lectura.valueRanges[0].values
  const fila = U.find((r) => r[1] === nombre)
  fila[3] = hashPin('sal1', pin); fila[4] = 'sal1'
  return lectura
}
function llamar(ruta, body, { token, lectura = fixture(), ahora = AHORA, tieneCapture = false } = {}) {
  return JSON.parse(JSON.stringify(procesar({ ruta, body, headers: token ? { authorization: `Bearer ${token}` } : {}, cfg, lectura, ahora, tieneCapture })))
}
function login(nombre = 'Jose') {
  const lectura = conPin(fixture(), nombre, '1234')
  const r = llamar('auth', { nombre, pin: '1234' }, { lectura })
  assert.equal(r.status, 200, JSON.stringify(r))
  return r.respuesta.token
}

test('sha256 y hmac coinciden con Node', async () => {
  const c = await import('node:crypto')
  assert.equal(hex(sha256(utf8Bytes('Bombi ñ €'))), c.createHash('sha256').update('Bombi ñ €').digest('hex'))
  assert.equal(hex(hmac(utf8Bytes('clave'), utf8Bytes('x'.repeat(200)))), c.createHmac('sha256', 'clave').update('x'.repeat(200)).digest('hex'))
})

test('login con PIN correcto e incorrecto', () => {
  const lectura = conPin(fixture(), 'Jose', '1234')
  const ok = llamar('auth', { nombre: 'jose', pin: '1234' }, { lectura })
  assert.equal(ok.respuesta.usuario.rol, 'admin')
  const mal = llamar('auth', { nombre: 'Jose', pin: '9999' }, { lectura })
  assert.equal(mal.status, 401); assert.equal(mal.paso, 'escribir')
  assert.match(mal.escrituras[0].rango, /^'Usuarios'!I\d+$/)
  const sinPin = llamar('auth', { nombre: 'Laura', pin: '1234' })
  assert.equal(sinPin.status, 403)
})

test('bloqueo tras 5 intentos', () => {
  const lectura = conPin(fixture(), 'Jose', '1234')
  lectura.valueRanges[0].values[1][8] = 4
  const r = llamar('auth', { nombre: 'Jose', pin: '0000' }, { lectura })
  assert.equal(r.escrituras.length, 2)
  lectura.valueRanges[0].values[1][9] = new Date(AHORA.getTime() + 5 * 60000).toISOString()
  assert.equal(llamar('auth', { nombre: 'Jose', pin: '1234' }, { lectura }).status, 429)
})

test('initData de Telegram', () => {
  const user = JSON.stringify({ id: 1000000002, first_name: 'Laura' })
  const params = { auth_date: String(Math.floor(AHORA.getTime() / 1000) - 60), query_id: 'AAA', user }
  const dcs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('\n')
  const clave = hmac(utf8Bytes('WebAppData'), utf8Bytes('123:ABC'))
  const hash = hex(hmac(clave, utf8Bytes(dcs)))
  const initData = Object.entries({ ...params, hash }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
  const r = llamar('auth', { initData })
  assert.equal(r.respuesta.estado, 'activo'); assert.equal(r.respuesta.usuario.nombre, 'Laura')
  assert.equal(llamar('auth', { initData: initData.replace('Laura', 'Lauro') }).status, 401)
  // Usuario nuevo: queda pendiente y se avisa a los admins
  const user2 = JSON.stringify({ id: 999, first_name: 'Paola' })
  const p2 = { ...params, user: user2 }
  const h2 = hex(hmac(clave, utf8Bytes(Object.keys(p2).sort().map((k) => `${k}=${p2[k]}`).join('\n'))))
  const r2 = llamar('auth', { initData: Object.entries({ ...p2, hash: h2 }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') })
  assert.equal(r2.respuesta.estado, 'pendiente'); assert.equal(r2.avisos.length, 2); assert.equal(r2.escrituras[0].hoja, 'Usuarios')
})

test('token: sin token, falso y válido', () => {
  assert.equal(llamar('resumen', { periodo: 'hoy' }).status, 401)
  assert.equal(llamar('resumen', { periodo: 'hoy' }, { token: 'abc.def' }).status, 401)
  const t = login()
  assert.equal(llamar('resumen', { periodo: 'hoy' }, { token: t, ahora: new Date(AHORA.getTime() + 31 * 864e5) }).status, 401)
})

test('resumen coincide con la pestaña Resumen del Sheet (6 oct)', () => {
  const t = login()
  const ahora = new Date('2026-10-06T22:00:00Z')
  const hoy = llamar('resumen', { periodo: 'hoy' }, { token: t, ahora }).respuesta
  assert.equal(hoy.ventas_usd, 18.5); assert.equal(hoy.gastos_usd, 41.84)
  const sem = llamar('resumen', { periodo: 'semana' }, { token: t, ahora }).respuesta
  assert.equal(sem.ventas_usd, 47.5)
  const mes = llamar('resumen', { periodo: 'mes' }, { token: t, ahora }).respuesta
  assert.equal(mes.ventas_usd, 93.96); assert.equal(mes.gastos_usd, 54.36)
  assert.equal(mes.ultimos.length, 5)
  assert.equal(mes.tasa.tasa, 872.3927)
  assert.equal(mes.por_cobrar.cantidad, 1)
})

test('registrar venta en Bs: fila en el orden de columnas del Sheet', () => {
  const t = login()
  const r = llamar('registro', { tipo: 'venta', request_id: 'r1', fecha: '2026-10-07', monto: 4362, moneda: 'Bs', tasa: 872.3927,
    metodo: 'Pago Móvil', referencia: '000123', banco: 'Banesco', cliente: '=HACK()', productos: '2x NY Milka 100g', cantidad: 2 }, { token: t })
  assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.paso, 'escribir')
  const f = r.escrituras[0].fila
  assert.equal(r.escrituras[0].hoja, 'Ventas'); assert.match(f[0], /^V-261007-113000$/)
  assert.deepEqual(f.slice(1, 13), ['2026-10-07', '11:30', '2x NY Milka 100g', 2, 4362, 'Bs', 872.3927, 5, 4362, 'Pago Móvil', 'Banesco', "'000123"])
  assert.equal(f[13], "'=HACK()"); assert.equal(f[14], 'Jose'); assert.equal(f[16], 'webapp'); assert.equal(f[19], 'r1')
})

test('referencia repetida y request id repetido', () => {
  const t = login()
  const base = { tipo: 'venta', monto: 10, moneda: 'USD', metodo: 'Zelle', referencia: '90000002' }
  const r = llamar('registro', base, { token: t })
  assert.equal(r.status, 409); assert.equal(r.respuesta.duplicado.tipo, 'venta')
  assert.equal(llamar('registro', { ...base, confirmar_duplicado: true }, { token: t }).status, 200)
  const lectura = conPin(fixture(), 'Jose', '1234')
  lectura.valueRanges[1].values[3][19] = 'rid-9'
  assert.equal(llamar('registro', { ...base, request_id: 'rid-9' }, { token: t, lectura }).respuesta.repetido, true)
})

test('gasto con categoría inválida y válida', () => {
  const t = login()
  const b = { tipo: 'gasto', monto: 20, moneda: 'USD', metodo: 'Efectivo USD', categoria: 'Otro', concepto: 'Bolsas' }
  assert.equal(llamar('registro', b, { token: t }).status, 400)
  const r = llamar('registro', { ...b, categoria: 'Empaques' }, { token: t })
  assert.equal(r.escrituras[0].hoja, 'Gastos'); assert.equal(r.escrituras[0].fila[4], 'Empaques')
})

test('orden por cobrar y cobro', () => {
  const t = login()
  const pc = llamar('por-cobrar', {}, { token: t }).respuesta
  assert.equal(pc.proximo_numero, 3); assert.equal(pc.ordenes[0].orden, 1); assert.equal(pc.hay_bs, true)
  const o = llamar('registro', { tipo: 'cobrar', cliente: 'Clínica', productos: '10x Brownie 150g', monto: 25, fecha_entrega: '2026-10-05' }, { token: t })
  assert.equal(o.respuesta.orden, 3); assert.equal(o.escrituras[0].fila[6], '2026-10-09')
  const c = llamar('cobrar', { orden: 1, monto: 2181.5, moneda: 'Bs', tasa: 872.6, metodo: 'Pago Móvil', referencia: '555', fecha: '2026-10-07', request_id: 'c1' }, { token: t })
  assert.equal(c.status, 200, JSON.stringify(c))
  assert.equal(c.escrituras[0].hoja, 'Ventas'); assert.equal(c.escrituras[0].fila[15], 1)
  assert.ok(c.escrituras.some((e) => e.rango === "'Por cobrar'!H2" && e.valor === 'pagado'))
  assert.equal(llamar('cobrar', { orden: 2, monto: 1, moneda: 'USD', metodo: 'Zelle' }, { token: t }).status, 404)
})

test('permisos de admin y anular', () => {
  const tv = login('Victor')
  assert.equal(llamar('anular', { tipo: 'venta', id: 'V-261004-160758' }, { token: tv }).status, 403)
  const t = login()
  const r = llamar('anular', { tipo: 'venta', id: 'V-261004-160758' }, { token: t })
  assert.equal(r.escrituras[0].rango, "'Ventas'!S4"); assert.equal(r.escrituras[0].valor, 'sí')
})

test('usuarios: crear, cambiar PIN y proteger último admin', () => {
  const t = login()
  const c = llamar('usuarios-accion', { accion: 'crear', nombre: 'Ana', pin: '4321', rol: 'usuario' }, { token: t })
  assert.equal(c.escrituras[0].hoja, 'Usuarios'); assert.equal(c.escrituras[0].fila[3].length, 64)
  assert.equal(llamar('usuarios-accion', { accion: 'crear', nombre: 'josé', pin: '4321' }, { token: t }).status, 409)
  assert.equal(llamar('usuarios-accion', { accion: 'desactivar', id: 'u1' }, { token: t }).status, 400)
  const p = llamar('usuarios-accion', { accion: 'cambiar_pin', id: 'u3', pin: '5678' }, { token: t })
  assert.equal(p.escrituras.length, 4)
})

test('productos y tasa', () => {
  const t = login()
  const p = llamar('productos', {}, { token: t }).respuesta.productos
  assert.equal(p[0].activo, true)
  const g = llamar('productos-guardar', { productos: [{ id: 'brownie-150', precio: 3, activo: false }] }, { token: t })
  assert.equal(g.escrituras.length, 2)
  assert.equal(llamar('tasa', {}, { token: t }).respuesta.fuente, 'última venta')
  assert.equal(llamar('tasa-actualizar', {}, { token: t }).paso, 'tasa')
})

test('orden por cobrar con request id no se duplica', () => {
  const t = login()
  const lectura = conPin(fixture(), 'Jose', '1234')
  const pc = lectura.valueRanges.find((v) => v.range.startsWith("'Por cobrar'")).values
  pc[0].push('Request id')
  const o = { tipo: 'cobrar', cliente: 'Clínica', productos: '1x Brownie', monto: 5, request_id: 'ord-1' }
  const r = llamar('registro', o, { token: t, lectura })
  assert.equal(r.escrituras[0].fila.at(-1), 'ord-1')
  pc.push([3, 46301, 'Clínica', '1x Brownie', 5, 'USD', 46304, 'pendiente', '', '', '', 'Jose', 'webapp', '', '', '', '', '', 'ord-1'])
  const r2 = llamar('registro', o, { token: t, lectura })
  assert.equal(r2.respuesta.repetido, true); assert.equal(r2.escrituras.length, 0)
  // Sin la columna, la orden se guarda igual (sin Request id).
  assert.equal(llamar('registro', o, { token: t }).escrituras[0].fila.length, 13)
})

test('capture: marca el link y nombra el archivo con el ID', () => {
  const t = login()
  const b = { tipo: 'gasto', monto: 20, moneda: 'USD', metodo: 'Efectivo USD', categoria: 'Empaques', concepto: 'Bolsas', request_id: 'g-cap' }
  const r = llamar('registro', b, { token: t, tieneCapture: true })
  assert.equal(r.paso, 'escribir'); assert.match(r.capture_nombre, /^G-/)
  assert.ok(r.escrituras[0].fila.includes('{{LINK_CAPTURE}}'))
  assert.equal(llamar('registro', b, { token: t }).capture_nombre, undefined)
})

test('abonos parciales: la orden sigue pendiente hasta cubrir el monto', () => {
  const t = login()
  const lectura = conPin(fixture(), 'Jose', '1234')
  const pc = lectura.valueRanges.find((v) => v.range.startsWith("'Por cobrar'")).values
  const ventas = lectura.valueRanges.find((v) => v.range.startsWith('Ventas')).values
  pc.push([3, 46301, 'PuroLomo', '7 galletas', 25, 'USD', 46304, 'pendiente'])
  const pago = (monto, rid) => ({ orden: 3, monto, moneda: 'USD', tasa: 872.39, metodo: 'Zelle', referencia: 'Z' + rid, fecha: '2026-10-07', request_id: rid })
  // Primer abono: $10 → sigue pendiente, faltan $15.
  const a1 = llamar('cobrar', pago(10, 'a1'), { token: t, lectura })
  assert.equal(a1.status, 200, JSON.stringify(a1.respuesta))
  assert.equal(a1.respuesta.cerrada, false); assert.equal(a1.respuesta.saldo_usd, 15)
  assert.ok(!a1.escrituras.some((e) => e.valor === 'pagado'))
  assert.ok(a1.escrituras.some((e) => /Q\d+$/.test(e.rango) && e.valor === 10)) // Monto pagado USD acumulado
  // Simula que la venta del abono ya está en la hoja.
  const filaVenta = (id, usd, rid) => { const r = Array(20).fill(''); Object.assign(r, { 0: id, 1: 46302, 5: usd, 6: 'USD', 8: usd, 15: 3, 16: 'webapp', 19: rid }); return r }
  ventas.push(filaVenta('V-A1', 10, 'a1'))
  let lista = llamar('por-cobrar', {}, { token: t, lectura }).respuesta
  const o3 = lista.ordenes.find((o) => o.orden === 3)
  assert.equal(o3.pagado_usd, 10); assert.equal(o3.saldo_usd, 15)
  // Segundo abono: $14.60 → cubre con la tolerancia de $0,50 y se cierra.
  const a2 = llamar('cobrar', pago(14.6, 'a2'), { token: t, lectura })
  assert.equal(a2.respuesta.cerrada, true); assert.equal(a2.respuesta.pagado_usd, 24.6)
  assert.ok(a2.escrituras.some((e) => e.valor === 'pagado'))
  // Mismo request id → no se registra dos veces.
  ventas.push(filaVenta('V-A2', 14.6, 'a2'))
  assert.equal(llamar('cobrar', pago(14.6, 'a2'), { token: t, lectura }).respuesta.repetido, true)
  // La orden con abonos no se puede anular directo.
  assert.equal(llamar('anular', { tipo: 'cobrar', id: 'o3' }, { token: t, lectura }).status, 400)
  // Anular un abono de una orden cerrada la reabre y baja lo cobrado.
  pc[pc.length - 1][7] = 'pagado'
  const an = llamar('anular', { tipo: 'venta', id: 'V-A2' }, { token: t, lectura })
  assert.equal(an.status, 200)
  assert.ok(an.escrituras.some((e) => /H\d+$/.test(e.rango) && e.valor === 'pendiente'))
  assert.ok(an.escrituras.some((e) => /Q\d+$/.test(e.rango) && e.valor === 10))
})

test('últimos registros: por momento de registro, con la fecha del pago aparte', () => {
  const t = login()
  const lectura = conPin(fixture(), 'Jose', '1234')
  const ventas = lectura.valueRanges.find((v) => v.range.startsWith('Ventas')).values
  // Pago del 6 de octubre registrado el 7 a las 14:02 (caso Kimberly).
  const r = Array(20).fill(''); Object.assign(r, { 0: 'V-261007-140245', 1: 46301, 2: 0.58, 5: 17340, 6: 'Bs', 8: 19.88, 14: 'Jose', 16: 'webapp' })
  ventas.push(r)
  const res = llamar('resumen', { periodo: 'hoy' }, { token: t, lectura }).respuesta
  assert.equal(res.ultimos[0].id, 'V-261007-140245')
  assert.equal(res.ultimos[0].fecha, '2026-10-06'); assert.equal(res.ultimos[0].registrado, '2026-10-07')
})
