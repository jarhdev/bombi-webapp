// Mismos valores que usa el bot de Telegram (nodo "Armar registro") y las listas del Sheet,
// para que las filas de la app y del bot se mezclen sin problema.
export const METODOS = ['Pago Móvil', 'Transferencia', 'Punto de venta', 'Efectivo Bs', 'Efectivo USD', 'Zelle', 'Binance']
export const CATEGORIAS_GASTO = ['Ingredientes', 'Empaques', 'Delivery', 'Servicios', 'Equipos', 'Publicidad', 'Otros']

// En el Sheet la moneda se guarda como "Bs" o "USD"; en pantalla "USD" se muestra como "$".
export const MONEDAS = ['Bs', 'USD']
export const OPCIONES_MONEDA = [
  { value: 'Bs', label: 'Bs' },
  { value: 'USD', label: '$' },
]

// Moneda que corresponde a cada método (se puede cambiar a mano).
export const MONEDA_POR_METODO = {
  'Pago Móvil': 'Bs',
  Transferencia: 'Bs',
  'Punto de venta': 'Bs',
  'Efectivo Bs': 'Bs',
  'Efectivo USD': 'USD',
  Zelle: 'USD',
  Binance: 'USD',
}

// Métodos donde tiene sentido pedir banco.
export const METODOS_CON_BANCO = ['Pago Móvil', 'Transferencia', 'Punto de venta']
