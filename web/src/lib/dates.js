// Todas las fechas del negocio se calculan en hora de Venezuela (UTC-4, sin horario de verano).
export const TZ = 'America/Caracas'

// Fecha de hoy en Caracas como 'YYYY-MM-DD'.
export function hoyISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

function parse(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const fmt = (date) => date.toISOString().slice(0, 10)

export function addDays(iso, n) {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

// 0 = domingo … 6 = sábado
export const weekday = (iso) => parse(iso).getUTCDay()

// Viernes siguiente a la fecha de entrega (si se entrega un viernes, el de la semana siguiente).
export function viernesSiguiente(iso) {
  const wd = weekday(iso)
  const diff = (5 - wd + 7) % 7 || 7
  return addDays(iso, diff)
}

// Rango [desde, hasta] inclusive del periodo, con semana de lunes a domingo.
export function rangoPeriodo(periodo, hoy = hoyISO()) {
  if (periodo === 'semana') {
    const desde = addDays(hoy, -((weekday(hoy) + 6) % 7))
    return [desde, addDays(desde, 6)]
  }
  if (periodo === 'mes') {
    const desde = hoy.slice(0, 8) + '01'
    const d = parse(desde)
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCDate(0)
    return [desde, fmt(d)]
  }
  return [hoy, hoy]
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const nombreDia = (iso) => DIAS[weekday(iso)]

// '2026-10-09' → '9 oct'
export function fechaCorta(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1]}`
}

// Etiqueta amigable: Hoy, Ayer, o '9 oct'
export function fechaRelativa(iso, hoy = hoyISO()) {
  if (iso === hoy) return 'Hoy'
  if (iso === addDays(hoy, -1)) return 'Ayer'
  return fechaCorta(iso)
}

// Aviso cuando la fecha del pago no es hoy (p. ej. un capture de ayer que se registra hoy).
export function avisoFechaPago(iso, hoy = hoyISO()) {
  if (!iso || iso === hoy) return null
  const cuando = iso === addDays(hoy, -1) ? `de ayer (${fechaCorta(iso)})` : `del ${nombreDia(iso)} ${fechaCorta(iso)}`
  return `Este pago es ${cuando}, no de hoy: se contará en ese día. ¿Es correcto?`
}
