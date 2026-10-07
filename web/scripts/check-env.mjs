// Revisa la configuración antes de compilar, para no publicar por error una app sin conexión a n8n.
// Netlify define CONTEXT=production al publicar el sitio principal.
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), '')
const mocks = env.VITE_USE_MOCKS !== 'false'
const api = env.N8N_API_URL?.trim()
const errores = []

if (env.CONTEXT === 'production' && mocks) {
  errores.push('La publicación de producción quedaría en modo demo. Define VITE_USE_MOCKS=false en Netlify.')
}
if (!mocks) {
  if (!api) errores.push('VITE_USE_MOCKS=false pero falta N8N_API_URL: la app no podría hablar con n8n.')
  else if (!/^https:\/\/[^/]+\/webhook\/[^/]+\/bombi\/?$/.test(api)) {
    errores.push(`N8N_API_URL no tiene el formato esperado (https://<n8n>/webhook/<id>/bombi): ${api}`)
  }
}

if (errores.length) {
  for (const e of errores) console.error(`[config] ${e}`)
  process.exit(1)
}
console.log(`[config] ${mocks ? 'Modo demo (datos de prueba)' : `API real: ${new URL(api).host}`}`)
