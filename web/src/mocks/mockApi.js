// Implementación de prueba del API de n8n. Guarda todo en el navegador (localStorage)
// para que la app se pueda usar de punta a punta sin backend. Mismo contrato que api/http.js.
import { seedDb } from './seed.js'
import { hoyISO } from '../lib/dates.js'
import { rangoPeriodo } from '../lib/dates.js'
import { round2, toUsd } from '../lib/format.js'
import { ApiError } from '../api/errors.js'
import { getToken } from '../api/session.js'

const KEY = 'bombi-mock-db-v3'
const vistos = new Set() // request_id ya procesados (idempotencia)

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* sin almacenamiento: se usa la semilla en memoria */ }
  const db = seedDb()
  save(db)
  return db
}
let memo = null
const db = () => (memo ??= load())
function save(d = memo) {
  memo = d
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* ignorar */ }
}

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))
const nextId = (p) => `${p}${++db().seq}`

function usuarioActual() {
  const id = getToken()?.replace(/^mock\./, '')
  const u = db().usuarios.find((x) => x.id === id && x.estado === 'activo')
  if (!u) throw new ApiError('Tu sesión expiró. Vuelve a entrar.', 401)
  return u
}
function soloAdmin() {
  const u = usuarioActual()
  if (u.rol !== 'admin') throw new ApiError('Solo un admin puede hacer esto.', 403)
  return u
}
const publico = (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, estado: u.estado })

function ultimaTasa() {
  const t = db().tasas
  return t[t.length - 1]
}

// Las órdenes del bot pueden estar en Bs: para el total se convierten con la tasa de hoy.
function totalOrdenesUsd(ordenes) {
  const t = ultimaTasa().tasa
  return round2(ordenes.reduce((s, o) => s + toUsd(o.monto, o.moneda, t), 0))
}

function idempotente(req) {
  if (!req.request_id) return false
  if (vistos.has(req.request_id)) return true
  vistos.add(req.request_id)
  return false
}

function refDuplicada(referencia, excluirId) {
  if (!referencia) return null
  const ref = String(referencia).trim()
  const v = db().ventas.find((x) => !x.anulado && x.id !== excluirId && String(x.referencia).trim() === ref)
  if (v) return { tipo: 'venta', fecha: v.fecha, monto: v.monto, moneda: v.moneda, cliente: v.cliente }
  const g = db().gastos.find((x) => !x.anulado && String(x.referencia).trim() === ref)
  if (g) return { tipo: 'gasto', fecha: g.fecha, monto: g.monto, moneda: g.moneda, cliente: g.concepto }
  return null
}

export const mockApi = {
  async auth({ initData, nombre, pin }) {
    await wait()
    if (initData) {
      // En la app real n8n valida la firma HMAC de initData. Aquí entramos como el primer admin.
      const u = db().usuarios[0]
      return { estado: u.estado, usuario: publico(u), token: `mock.${u.id}` }
    }
    const u = db().usuarios.find((x) => x.nombre.toLowerCase() === String(nombre).trim().toLowerCase())
    const ahora = Date.now()
    if (u?.bloqueado_hasta && Date.parse(u.bloqueado_hasta) > ahora) {
      const min = Math.ceil((Date.parse(u.bloqueado_hasta) - ahora) / 60000)
      throw new ApiError(`Demasiados intentos. Espera ${min} min.`, 429)
    }
    if (!u || u.pin !== String(pin)) {
      if (u) {
        u.intentos_fallidos += 1
        if (u.intentos_fallidos >= 5) {
          u.intentos_fallidos = 0
          u.bloqueado_hasta = new Date(ahora + 10 * 60000).toISOString()
        }
        save()
      }
      throw new ApiError('Nombre o PIN incorrecto.', 401)
    }
    if (u.estado !== 'activo') throw new ApiError(u.estado === 'pendiente' ? 'Tu usuario está pendiente de aprobación.' : 'Tu usuario está desactivado.', 403)
    u.intentos_fallidos = 0
    u.bloqueado_hasta = ''
    save()
    return { estado: 'activo', usuario: publico(u), token: `mock.${u.id}` }
  },

  async resumen(periodo) {
    await wait()
    usuarioActual()
    const [desde, hasta] = rangoPeriodo(periodo)
    const enRango = (x) => !x.anulado && x.fecha >= desde && x.fecha <= hasta
    const ventas = round2(db().ventas.filter(enRango).reduce((s, x) => s + x.monto_usd, 0))
    const gastos = round2(db().gastos.filter(enRango).reduce((s, x) => s + x.monto_usd, 0))
    const pend = db().porCobrar.filter((o) => o.estado === 'pendiente')
    const movimientos = [
      ...db().ventas.map((v) => ({
        id: v.id, tipo: 'venta', fecha: v.fecha, creado: v.creado, anulado: v.anulado,
        titulo: v.orden ? `Venta · Orden #${v.orden}` : `Venta · ${v.metodo}`,
        detalle: [v.cliente || v.productos, `${v.registrado_por}${v.origen === 'bot' ? ' (bot)' : ''}`].filter(Boolean).join(' · '),
        monto_usd: v.monto_usd,
      })),
      ...db().gastos.map((g) => ({
        id: g.id, tipo: 'gasto', fecha: g.fecha, creado: g.creado, anulado: g.anulado,
        titulo: `Gasto · ${g.categoria}`, detalle: [g.concepto, g.registrado_por].filter(Boolean).join(' · '),
        monto_usd: g.monto_usd,
      })),
      ...db().porCobrar.map((o) => ({
        id: `o${o.orden}`, tipo: 'cobrar', fecha: o.fecha_entrega, creado: o.creado, anulado: o.estado === 'anulada',
        titulo: `Orden #${o.orden} · ${o.cliente}`, detalle: o.estado === 'pagado' ? 'Cobrada' : 'Pendiente de cobro',
        monto_usd: toUsd(o.monto, o.moneda, ultimaTasa().tasa),
      })),
    ].sort((a, b) => (b.creado || '').localeCompare(a.creado || ''))
    return {
      desde, hasta,
      ventas_usd: ventas, gastos_usd: gastos, ganancia_usd: round2(ventas - gastos),
      por_cobrar: { cantidad: pend.length, total_usd: totalOrdenesUsd(pend) },
      ultimos: movimientos.slice(0, 5),
      tasa: ultimaTasa(),
    }
  },

  async tasa() {
    await wait(150)
    return ultimaTasa()
  },

  async actualizarTasa() {
    await wait(900)
    soloAdmin()
    const t = ultimaTasa()
    return { ...t, consultada: new Date().toISOString(), sin_cambios: true }
  },

  async leerCapture() {
    await wait(1400)
    usuarioActual()
    // Simula la respuesta de Gemini.
    const ref = String(Math.floor(100000 + Math.random() * 899999))
    return { monto: 4600, moneda: 'Bs', referencia: ref, fecha: hoyISO(), metodo: 'Pago Móvil', banco: 'Banesco' }
  },

  async registrar(req) {
    await wait(600)
    const u = usuarioActual()
    if (idempotente(req)) return { ok: true, repetido: true }
    const d = db()
    if (req.tipo === 'venta' || req.tipo === 'gasto') {
      const dup = refDuplicada(req.referencia)
      if (dup && !req.confirmar_duplicado) {
        vistos.delete(req.request_id)
        throw new ApiError('Esa referencia ya está registrada.', 409, { duplicado: dup })
      }
    }
    const id = (req.tipo === 'gasto' ? 'G-' : 'V-') + new Date().toISOString().replace(/\D/g, '').slice(2, 8) + '-' + String(++d.seq).padStart(6, '0')
    const base = { id, fecha: req.fecha, monto: req.monto, moneda: req.moneda, tasa: req.tasa, monto_usd: toUsd(req.monto, req.moneda, req.tasa), metodo: req.metodo, referencia: req.referencia || '', registrado_por: u.nombre, anulado: false, creado: new Date().toISOString() }
    if (req.tipo === 'venta') {
      const v = { ...base, cliente: req.cliente, productos: req.productos, cantidad: req.cantidad, banco: req.banco, origen: 'webapp', orden: '', capture: req.capture ? '(capture de prueba)' : '' }
      d.ventas.push(v)
      save()
      return { ok: true, id: v.id }
    }
    if (req.tipo === 'gasto') {
      const g = { ...base, categoria: req.categoria, concepto: req.concepto, proveedor: req.proveedor, capture: req.capture ? '(capture de prueba)' : '' }
      d.gastos.push(g)
      save()
      return { ok: true, id: g.id }
    }
    if (req.tipo === 'cobrar') {
      const orden = Math.max(0, ...d.porCobrar.map((o) => o.orden)) + 1
      d.porCobrar.push({ orden, fecha_entrega: req.fecha_entrega, cliente: req.cliente, productos: req.productos, monto: req.monto, moneda: 'USD', fecha_esperada_pago: req.fecha_esperada_pago, estado: 'pendiente', fecha_pago: '', referencia: '', registrado_por: u.nombre, creado: new Date().toISOString() })
      save()
      return { ok: true, orden }
    }
    throw new ApiError('Tipo de registro desconocido.', 400)
  },

  async porCobrar() {
    await wait()
    usuarioActual()
    const ordenes = db().porCobrar.filter((o) => o.estado === 'pendiente').sort((a, b) => a.orden - b.orden)
    const proximo = Math.max(0, ...db().porCobrar.map((o) => o.orden)) + 1
    return { ordenes, total_usd: totalOrdenesUsd(ordenes), hay_bs: ordenes.some((o) => o.moneda === 'Bs'), proximo_numero: proximo }
  },

  async cobrar(req) {
    await wait(700)
    const u = usuarioActual()
    if (idempotente(req)) return { ok: true, repetido: true }
    const d = db()
    const o = d.porCobrar.find((x) => x.orden === Number(req.orden))
    if (!o || o.estado !== 'pendiente') {
      vistos.delete(req.request_id)
      throw new ApiError(`La orden #${req.orden} no está pendiente.`, 404)
    }
    const dup = refDuplicada(req.referencia)
    if (dup && !req.confirmar_duplicado) {
      vistos.delete(req.request_id)
      throw new ApiError('Esa referencia ya está registrada.', 409, { duplicado: dup })
    }
    o.estado = 'pagado'
    o.fecha_pago = req.fecha
    o.referencia = req.referencia || ''
    o.tasa_pago = req.tasa
    o.monto_pagado = req.monto
    o.moneda_pago = req.moneda
    o.metodo_pago = req.metodo
    d.ventas.push({ id: nextId('V-'), fecha: req.fecha, cliente: o.cliente, productos: o.productos, monto: req.monto, moneda: req.moneda, tasa: req.tasa, monto_usd: toUsd(req.monto, req.moneda, req.tasa), metodo: req.metodo, banco: req.banco || '', referencia: req.referencia || '', origen: 'webapp', registrado_por: u.nombre, orden: o.orden, anulado: false, creado: new Date().toISOString(), capture: req.capture ? '(capture de prueba)' : '' })
    save()
    return { ok: true }
  },

  async anular({ tipo, id }) {
    await wait()
    soloAdmin()
    const d = db()
    if (tipo === 'cobrar') {
      const o = d.porCobrar.find((x) => `o${x.orden}` === id)
      if (!o || o.estado !== 'pendiente') throw new ApiError('Solo se pueden anular órdenes pendientes.', 400)
      o.estado = 'anulada'
    } else {
      const list = tipo === 'venta' ? d.ventas : d.gastos
      const r = list.find((x) => x.id === id)
      if (!r) throw new ApiError('Registro no encontrado.', 404)
      r.anulado = true
    }
    save()
    return { ok: true }
  },

  async productos() {
    await wait(200)
    return { productos: db().productos }
  },

  async guardarProductos({ productos }) {
    await wait()
    soloAdmin()
    db().productos = productos
    save()
    return { ok: true }
  },

  async usuarios() {
    await wait()
    soloAdmin()
    return { usuarios: db().usuarios.map((u) => ({ ...publico(u), telegram_id: u.telegram_id, fecha_creacion: u.fecha_creacion })) }
  },

  async usuarioAccion({ accion, id, nombre, pin, rol }) {
    await wait()
    soloAdmin()
    const d = db()
    if (accion === 'crear') {
      if (d.usuarios.some((u) => u.nombre.toLowerCase() === nombre.trim().toLowerCase())) throw new ApiError('Ya existe un usuario con ese nombre.', 409)
      d.usuarios.push({ id: nextId('u'), nombre: nombre.trim(), rol, estado: 'activo', telegram_id: '', pin, intentos_fallidos: 0, bloqueado_hasta: '', fecha_creacion: hoyISO() })
    } else {
      const u = d.usuarios.find((x) => x.id === id)
      if (!u) throw new ApiError('Usuario no encontrado.', 404)
      if (accion === 'aprobar' || accion === 'activar') u.estado = 'activo'
      else if (accion === 'desactivar') u.estado = 'inactivo'
      else if (accion === 'cambiar_pin') { u.pin = pin; u.intentos_fallidos = 0; u.bloqueado_hasta = '' }
      else if (accion === 'cambiar_rol') u.rol = rol
    }
    save()
    return { ok: true }
  },
}

export function resetMock() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
  memo = null
}
