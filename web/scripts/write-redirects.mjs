// Genera dist/_redirects para que Netlify reenvíe /api/* a n8n.
// Así el navegador nunca habla directo con n8n: no hay CORS y la URL de n8n no queda en el código.
import { writeFileSync } from 'node:fs'

const base = process.env.N8N_BASE_URL?.replace(/\/$/, '')
const lines = []
if (base) lines.push(`/api/*  ${base}/webhook/bombi/:splat  200`)
else console.warn('[redirects] N8N_BASE_URL no está definida: /api no se reenviará (modo demo).')
lines.push('/*  /index.html  200')
writeFileSync('dist/_redirects', lines.join('\n') + '\n')
console.log('[redirects] dist/_redirects escrito')
