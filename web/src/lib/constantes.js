// Listas editables: para agregar un método de pago o categoría basta con sumarlo aquí.
export const METODOS = ['Pago móvil', 'Efectivo', 'Transferencia', 'Divisas']
export const CATEGORIAS_GASTO = ['Ingredientes', 'Empaques', 'Delivery', 'Otro']
export const MONEDAS = ['Bs', '$']

// Moneda que se sugiere al elegir el método (se puede cambiar a mano).
export const MONEDA_POR_METODO = { 'Pago móvil': 'Bs', Transferencia: 'Bs', Divisas: '$' }
