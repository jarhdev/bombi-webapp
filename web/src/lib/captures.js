// Varios captures para un mismo pago (la persona pagó el total en partes).
// Cada capture se lee por separado con IA; aquí se combinan en un solo registro:
// monto sumado, referencias unidas con " / " y fecha/método/banco del primero leído.

export const MAX_CAPTURES = 5

// captures: [{ key, blob, dataUrl, estado: 'leyendo'|'leido'|'manual'|'error', datos }]
export function combinarLecturas(captures) {
  const validos = captures.filter((c) => c.blob)
  const leidos = validos.filter((c) => c.estado === 'leido' && c.datos)
  const monedas = new Set(leidos.map((c) => c.datos.moneda).filter(Boolean))
  const todosConMonto = validos.length > 0 && validos.every((c) => c.estado === 'leido' && Number(c.datos?.monto) > 0)
  const primero = (k) => leidos.map((c) => c.datos[k]).find(Boolean)
  const refs = leidos.map((c) => String(c.datos.referencia || '').trim()).filter(Boolean)
  return {
    cantidad: validos.length,
    monto: todosConMonto && monedas.size <= 1 ? Math.round(validos.reduce((s, c) => s + Number(c.datos.monto), 0) * 100) / 100 : null,
    moneda: monedas.size === 1 ? [...monedas][0] : null,
    referencia: refs.join(' / '),
    fecha: primero('fecha'),
    metodo: primero('metodo'),
    banco: primero('banco'),
    monedasDistintas: monedas.size > 1,
    sinLeer: validos.filter((c) => c.estado === 'manual').length,
    leyendo: validos.some((c) => c.estado === 'leyendo'),
  }
}

// Clave que cambia cuando se agrega, quita o termina de leer un capture.
export const firmaCaptures = (captures) => captures.map((c) => `${c.key}:${c.estado}`).join('|')
