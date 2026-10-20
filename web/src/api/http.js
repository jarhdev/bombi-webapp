// Cliente real: habla con los webhooks de n8n a través de /api (proxy de Netlify o de Vite).
import { ApiError } from './errors.js'
import { getToken, clearSession } from './session.js'

const BASE = '/api'
const TIMEOUT_MS = 45000

async function request(path, { method = 'GET', json, form } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (form) body = form
  else if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body, signal: ctrl.signal })
  } catch (e) {
    throw new ApiError(e.name === 'AbortError' ? 'El servidor tardó demasiado. Intenta de nuevo.' : 'Sin conexión con el servidor.', 0)
  } finally {
    clearTimeout(timer)
  }
  let data = null
  try { data = await res.json() } catch { /* respuesta vacía */ }
  if (!res.ok || data?.ok === false) {
    if (res.status === 401) clearSession()
    throw new ApiError(data?.error || `Error del servidor (${res.status}).`, res.status, data)
  }
  return data
}

// Arma un multipart con los campos en "data" (JSON) y los captures como archivos:
// "capture" el primero y "capture_2", "capture_3"… los demás (pagos en partes).
function multipart(campos, captures) {
  const form = new FormData()
  form.append('data', JSON.stringify(campos))
  const lista = (Array.isArray(captures) ? captures : [captures]).filter(Boolean)
  lista.forEach((c, i) => form.append(i ? `capture_${i + 1}` : 'capture', c, i ? `capture-${i + 1}.jpg` : 'capture.jpg'))
  return form
}

// Todas las rutas son POST /api/<ruta>; Netlify (o Vite en local) las reenvía al webhook de n8n.
const post = (ruta, json = {}) => request(`/${ruta}`, { method: 'POST', json })

export const httpApi = {
  auth: (body) => post('auth', body),
  resumen: (periodo) => post('resumen', { periodo }),
  tasa: () => post('tasa'),
  actualizarTasa: () => post('tasa-actualizar'),
  leerCapture: (blob) => request('/leer-capture', { method: 'POST', form: multipart({}, blob) }),
  registrar: ({ captures, ...campos }) => request('/registro', { method: 'POST', form: multipart(campos, captures) }),
  porCobrar: () => post('por-cobrar'),
  cobrar: ({ captures, ...campos }) => request('/cobrar', { method: 'POST', form: multipart(campos, captures) }),
  anular: (body) => post('anular', body),
  productos: () => post('productos'),
  inventario: () => post('inventario'),
  inventarioMover: (body) => post('inventario-mover', body),
  guardarProductos: (body) => post('productos-guardar', body),
  usuarios: () => post('usuarios'),
  usuarioAccion: (body) => post('usuarios-accion', body),
}
