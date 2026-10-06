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

// Arma un multipart con los campos en "data" (JSON) y el capture como archivo.
function multipart(campos, capture) {
  const form = new FormData()
  form.append('data', JSON.stringify(campos))
  if (capture) form.append('capture', capture, 'capture.jpg')
  return form
}

export const httpApi = {
  auth: (body) => request('/auth', { method: 'POST', json: body }),
  resumen: (periodo) => request(`/resumen?periodo=${encodeURIComponent(periodo)}`),
  tasa: () => request('/tasa'),
  actualizarTasa: () => request('/tasa', { method: 'POST', json: { accion: 'actualizar' } }),
  leerCapture: (blob) => request('/leer-capture', { method: 'POST', form: multipart({}, blob) }),
  registrar: ({ capture, ...campos }) => request('/registro', { method: 'POST', form: multipart(campos, capture) }),
  porCobrar: () => request('/por-cobrar'),
  cobrar: ({ capture, ...campos }) => request('/cobrar', { method: 'POST', form: multipart(campos, capture) }),
  anular: (body) => request('/anular', { method: 'POST', json: body }),
  productos: () => request('/productos'),
  guardarProductos: (body) => request('/productos', { method: 'POST', json: body }),
  usuarios: () => request('/usuarios'),
  usuarioAccion: (body) => request('/usuarios', { method: 'POST', json: body }),
}
