// Formato de montos venezolano: Bs. 1.234,56 y $12,50

function grouped(n) {
  const [ent, dec] = Math.abs(n).toFixed(2).split('.')
  return `${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}

export function formatMonto(n, moneda = '$') {
  const v = Number(n) || 0
  const sign = v < 0 ? '−' : ''
  return moneda === 'Bs' ? `${sign}Bs. ${grouped(v)}` : `${sign}$${grouped(v)}`
}

export const formatUsd = (n) => formatMonto(n, '$')
export const formatBs = (n) => formatMonto(n, 'Bs')

// Convierte lo que escribe la persona ("1.234,56", "1234.56", "12,5") a número.
export function parseMonto(text) {
  if (typeof text === 'number') return text
  let s = String(text ?? '').replace(/[^\d.,]/g, '').replace(/^[.,]+/, '')
  if (!s) return 0
  // "1.234" escrito en Venezuela es mil doscientos treinta y cuatro, no 1,234
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''))
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, '')
  } else if (lastComma === -1 && (s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// Para mostrar un número dentro de un input editable: 1234.5 → "1234,50"
export function montoInput(n) {
  if (n === '' || n == null) return ''
  return (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',')
}

export function toUsd(monto, moneda, tasa) {
  if (moneda === '$') return round2(monto)
  return tasa > 0 ? round2(monto / tasa) : 0
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
