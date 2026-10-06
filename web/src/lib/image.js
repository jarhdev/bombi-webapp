// Validación y compresión de captures en el navegador antes de subirlos.
export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_BYTES = 5 * 1024 * 1024
const MAX_LADO = 1600
const CALIDAD = 0.82

export function validarImagen(file) {
  if (!file) return 'No se seleccionó ninguna imagen.'
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Formato no permitido. Usa JPG, PNG o WEBP.'
  if (file.size > MAX_BYTES) return 'La imagen pesa más de 5 MB.'
  return null
}

function cargar(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')) }
    img.src = url
  })
}

// Devuelve { blob, dataUrl } en JPEG, con el lado mayor ≤ 1600 px.
export async function comprimirImagen(file) {
  const img = await cargar(file)
  const escala = Math.min(1, MAX_LADO / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.round(img.naturalWidth * escala)
  const h = Math.round(img.naturalHeight * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', CALIDAD))
  const dataUrl = canvas.toDataURL('image/jpeg', CALIDAD)
  return { blob, dataUrl }
}
