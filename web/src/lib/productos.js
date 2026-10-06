// Utilidades del catálogo y del texto legible de productos ("2x NY Nutella 160g, 1x Brownie 150g").

export const etiquetaProducto = (p) => `${p.nombre} ${p.presentacion}`.trim()

// Agrupa el catálogo activo para el formulario:
// { ny: [{ sabor, variantes: [producto100, producto160] }], otros: [producto] }
export function agruparCatalogo(productos) {
  const activos = productos.filter((p) => p.activo)
  const nyMap = new Map()
  const otros = []
  for (const p of activos) {
    if (p.categoria === 'NY Cookies') {
      if (!nyMap.has(p.nombre)) nyMap.set(p.nombre, [])
      nyMap.get(p.nombre).push(p)
    } else {
      otros.push(p)
    }
  }
  const ny = [...nyMap.entries()].map(([sabor, variantes]) => ({
    sabor,
    variantes: variantes.sort((a, b) => parseFloat(a.presentacion) - parseFloat(b.presentacion)),
  }))
  return { ny, otros }
}

// cantidades: { [productoId]: n }
export function textoProductos(cantidades, productos) {
  return productos
    .filter((p) => cantidades[p.id] > 0)
    .map((p) => `${cantidades[p.id]}x ${etiquetaProducto(p)}`)
    .join(', ')
}

export function totalProductos(cantidades, productos) {
  const total = productos.reduce((s, p) => s + (cantidades[p.id] || 0) * p.precio, 0)
  return Math.round(total * 100) / 100
}
