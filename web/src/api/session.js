// Sesión guardada en el navegador: token firmado por n8n + datos básicos del usuario.
const KEY = 'bombi-sesion'

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (s?.expira && Date.parse(s.expira) < Date.now()) return null
    return s
  } catch {
    return null
  }
}
export const getToken = () => getSession()?.token || null

export function saveSession({ token, usuario, expira }) {
  try { localStorage.setItem(KEY, JSON.stringify({ token, usuario, expira })) } catch { /* */ }
}
export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
}
