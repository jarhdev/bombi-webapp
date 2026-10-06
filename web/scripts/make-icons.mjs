// Genera los íconos PNG de la PWA a partir de public/logo.svg usando el Chromium de Playwright.
// Uso: npm run icons  (requiere `npx playwright` disponible; no hace falta en el build de Netlify)
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const svg = readFileSync('public/logo.svg', 'utf8')
const targets = [
  { file: 'icon-192.png', size: 192, pad: 0.1 },
  { file: 'icon-512.png', size: 512, pad: 0.1 },
  { file: 'icon-maskable-512.png', size: 512, pad: 0.22 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.1 },
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
const page = await browser.newPage()
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2))
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<html><body style="margin:0;background:#f4e9d6;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`)
  await page.screenshot({ path: `public/${t.file}` })
  console.log('ok', t.file)
}
await browser.close()
