// Genera dist/_redirects para que Netlify reenvíe /api/* a n8n.
// Así el navegador nunca habla directo con n8n: no hay CORS y la URL de n8n no queda en el código.
import { writeFileSync } from 'node:fs'

// N8N_API_URL = URL del webhook "API Bombi" sin la ruta final, p. ej.
// https://mi-n8n.ts.net/webhook/965c5b23-db71-4888-825a-09d1943686ab/bombi
const base = process.env.N8N_API_URL?.replace(/\/$/, '')
const lines = []
if (base) lines.push(`/api/*  ${base}/:splat  200!`)
else console.warn('[redirects] N8N_API_URL no está definida: /api no se reenviará (modo demo).')
lines.push('/*  /index.html  200')
writeFileSync('dist/_redirects', lines.join('\n') + '\n')
console.log('[redirects] dist/_redirects escrito')
