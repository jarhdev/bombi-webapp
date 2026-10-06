// Datos de prueba para la Fase 2. Imitan lo que devolverá n8n.
import { addDays, hoyISO, viernesSiguiente } from '../lib/dates.js'

const NY = ['NY Red Velvet', 'NY Milka', 'NY Nutella', 'NY Lemon', 'NY Cri Cri', 'NY Pirulin']

export function seedProductos() {
  const list = []
  for (const sabor of NY) {
    list.push({ id: `${slug(sabor)}-100`, nombre: sabor, categoria: 'NY Cookies', presentacion: '100g', precio: 2.5, activo: true })
    list.push({ id: `${slug(sabor)}-160`, nombre: sabor, categoria: 'NY Cookies', presentacion: '160g', precio: 3.5, activo: true })
  }
  list.push(
    { id: 'thin-40', nombre: 'Thin Cookies', categoria: 'Otros', presentacion: '40g', precio: 2, activo: true },
    { id: 'banana-500', nombre: 'Banana Bread', categoria: 'Otros', presentacion: '500g', precio: 4.5, activo: true },
    { id: 'brownie-150', nombre: 'Brownie', categoria: 'Otros', presentacion: '150g', precio: 2.5, activo: true },
    { id: 'chocochips-5', nombre: 'Chocochips', categoria: 'Otros', presentacion: 'Pack de 5', precio: 2, activo: true },
  )
  return list
}

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
}

export function seedDb() {
  const hoy = hoyISO()
  const tasa = 200
  const lunes = addDays(hoy, -((new Date(hoy).getUTCDay() + 6) % 7))
  return {
    seq: 100,
    tasas: [
      { fecha_valor: addDays(hoy, -1), tasa: 198.4, fuente: 'dolarapi', consultada: `${addDays(hoy, -1)}T08:00:00-04:00` },
      { fecha_valor: hoy, tasa, fuente: 'dolarapi', consultada: `${hoy}T08:00:00-04:00` },
    ],
    usuarios: [
      { id: 'u1', nombre: 'Jose', rol: 'admin', estado: 'activo', telegram_id: '', pin: '1234', intentos_fallidos: 0, bloqueado_hasta: '', fecha_creacion: addDays(hoy, -30) },
      { id: 'u2', nombre: 'Admin 2', rol: 'admin', estado: 'activo', telegram_id: '', pin: '1234', intentos_fallidos: 0, bloqueado_hasta: '', fecha_creacion: addDays(hoy, -30) },
      { id: 'u3', nombre: 'Vendedor', rol: 'usuario', estado: 'activo', telegram_id: '', pin: '5678', intentos_fallidos: 0, bloqueado_hasta: '', fecha_creacion: addDays(hoy, -10) },
      { id: 'u4', nombre: 'Nuevo (Telegram)', rol: 'usuario', estado: 'pendiente', telegram_id: '555000111', pin: '', intentos_fallidos: 0, bloqueado_hasta: '', fecha_creacion: hoy },
    ],
    productos: seedProductos(),
    ventas: [
      { id: 'v1', fecha: hoy, cliente: 'Oficina Torre Sur', productos: '4x NY Nutella 160g, 2x Brownie 150g', monto: 3800, moneda: 'Bs', tasa, monto_usd: 19, metodo: 'Pago móvil', referencia: '004512', origen: 'webapp', registrado_por: 'Jose', orden: '', anulado: false, creado: `${hoy}T10:15:00` },
      { id: 'v2', fecha: hoy, cliente: 'Cliente directo', productos: '', monto: 1400, moneda: 'Bs', tasa, monto_usd: 7, metodo: 'Pago móvil', referencia: '118833', origen: 'bot', registrado_por: 'Bot Telegram', orden: '', anulado: false, creado: `${hoy}T09:02:00` },
      { id: 'v3', fecha: addDays(hoy, -2), cliente: 'Farmacia Central', productos: '6x NY Red Velvet 100g', monto: 15, moneda: '$', tasa: 198.4, monto_usd: 15, metodo: 'Divisas', referencia: '', origen: 'webapp', registrado_por: 'Admin 2', orden: '', anulado: false, creado: `${addDays(hoy, -2)}T15:40:00` },
      { id: 'v4', fecha: addDays(hoy, -9), cliente: 'Colegio San José', productos: '10x NY Milka 160g', monto: 6900, moneda: 'Bs', tasa: 197, monto_usd: 35.03, metodo: 'Transferencia', referencia: '771204', origen: 'bot', registrado_por: 'Bot Telegram', orden: '', anulado: false, creado: `${addDays(hoy, -9)}T12:00:00` },
    ],
    gastos: [
      { id: 'g1', fecha: hoy, categoria: 'Ingredientes', descripcion: 'Harina y mantequilla', monto: 2400, moneda: 'Bs', tasa, monto_usd: 12, metodo: 'Pago móvil', referencia: '330019', registrado_por: 'Admin 2', anulado: false, creado: `${hoy}T08:30:00` },
      { id: 'g2', fecha: addDays(hoy, -3), categoria: 'Empaques', descripcion: 'Bolsas y stickers', monto: 8, moneda: '$', tasa: 198.4, monto_usd: 8, metodo: 'Divisas', referencia: '', registrado_por: 'Jose', anulado: false, creado: `${addDays(hoy, -3)}T11:00:00` },
    ],
    porCobrar: [
      { orden: 47, fecha_entrega: lunes, cliente: 'Panadería La Espiga', productos: '12x NY Nutella 160g, 6x Brownie 150g', monto: 57, moneda: '$', fecha_esperada_pago: viernesSiguiente(lunes), estado: 'pendiente', fecha_pago: '', referencia: '', registrado_por: 'Jose', creado: `${lunes}T09:00:00` },
      { orden: 48, fecha_entrega: lunes, cliente: 'Clínica El Bosque', productos: '20x NY Red Velvet 100g', monto: 50, moneda: '$', fecha_esperada_pago: viernesSiguiente(lunes), estado: 'pendiente', fecha_pago: '', referencia: '', registrado_por: 'Admin 2', creado: `${lunes}T10:00:00` },
      { orden: 49, fecha_entrega: addDays(lunes, 1), cliente: 'Constructora Aragua', productos: '10x Banana Bread 500g', monto: 45, moneda: '$', fecha_esperada_pago: viernesSiguiente(addDays(lunes, 1)), estado: 'pendiente', fecha_pago: '', referencia: '', registrado_por: 'Bot Telegram', creado: `${addDays(lunes, 1)}T09:30:00` },
    ],
  }
}
