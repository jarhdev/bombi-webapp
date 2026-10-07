import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Chips, Segmented, Sheet, TopBar } from '../components/ui.jsx'
import CaptureField from '../components/CaptureField.jsx'
import ProductPicker from '../components/ProductPicker.jsx'
import { api } from '../api/index.js'
import { formatBs, formatMonto, formatUsd, montoInput, parseMonto, round2, toUsd } from '../lib/format.js'
import { fechaCorta, hoyISO, viernesSiguiente } from '../lib/dates.js'
import { textoProductos, totalProductos } from '../lib/productos.js'
import { CATEGORIAS_GASTO, METODOS, METODOS_CON_BANCO, MONEDA_POR_METODO, MONEDAS, OPCIONES_MONEDA } from '../lib/constantes.js'
import { uid } from '../lib/uid.js'
import { vibrar } from '../telegram/tg.js'

const TIPOS = [
  { value: 'venta', label: 'Venta' },
  { value: 'gasto', label: 'Gasto' },
  { value: 'cobrar', label: 'Por cobrar' },
]
const BOTON = { venta: 'Guardar venta', gasto: 'Guardar gasto', cobrar: 'Guardar orden' }

const vacio = () => ({
  capture: null,
  monto: '',
  montoManual: false,
  moneda: 'Bs',
  fecha: hoyISO(),
  fechaCobro: viernesSiguiente(hoyISO()),
  cliente: '',
  categoria: '',
  concepto: '',
  proveedor: '',
  metodo: 'Pago Móvil',
  banco: '',
  referencia: '',
  cantidades: {},
  ia: {},
})

export default function Registro({ tipoInicial = 'venta', back, notify, productos }) {
  const [tipo, setTipo] = useState(tipoInicial)
  const [f, setF] = useState(vacio)
  const [tasaDia, setTasaDia] = useState(null)
  const [tasaCargando, setTasaCargando] = useState(true)
  const [tasaManual, setTasaManual] = useState('')
  const [editTasa, setEditTasa] = useState(false)
  const [proximo, setProximo] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [duplicado, setDuplicado] = useState(null)
  const [error, setError] = useState(null)
  const requestId = useRef(uid())

  const set = (patch) => {
    setF((prev) => ({ ...prev, ...patch }))
    setError(null)
  }

  useEffect(() => {
    api.tasa().then(setTasaDia).catch(() => setTasaDia(null)).finally(() => setTasaCargando(false))
  }, [])
  useEffect(() => {
    if (tipo === 'cobrar') api.porCobrar().then((d) => setProximo(d.proximo_numero)).catch(() => {})
  }, [tipo])

  const esCobrar = tipo === 'cobrar'
  const moneda = esCobrar ? 'USD' : f.moneda
  const tasa = editTasa ? parseMonto(tasaManual) : tasaDia?.tasa || 0
  const totalUsd = useMemo(() => totalProductos(f.cantidades, productos), [f.cantidades, productos])
  const cantidadTotal = Object.values(f.cantidades).reduce((s, n) => s + n, 0)

  // El monto se calcula solo con el catálogo hasta que la persona lo edita (o lo llena la IA).
  const montoAuto = moneda === 'USD' ? totalUsd : round2(totalUsd * tasa)
  const montoTexto = f.montoManual ? f.monto : totalUsd > 0 ? montoInput(montoAuto) : ''
  const montoNum = parseMonto(montoTexto)
  const montoUsd = toUsd(montoNum, moneda, tasa)

  function cambiarTipo(t) {
    setTipo(t)
    setError(null)
  }

  function onLeido(d) {
    const patch = { ia: {} }
    if (d.monto) { patch.monto = montoInput(d.monto); patch.montoManual = true; patch.ia.monto = true }
    if (d.moneda && MONEDAS.includes(d.moneda)) patch.moneda = d.moneda
    if (d.referencia) { patch.referencia = String(d.referencia); patch.ia.referencia = true }
    if (d.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) { patch.fecha = d.fecha; patch.ia.fecha = true }
    if (d.metodo && METODOS.includes(d.metodo)) { patch.metodo = d.metodo; patch.ia.metodo = true }
    if (d.banco) { patch.banco = d.banco; patch.ia.banco = true }
    set(patch)
    vibrar('light')
  }

  function elegirMetodo(m) {
    set({ metodo: m, ...(MONEDA_POR_METODO[m] ? { moneda: MONEDA_POR_METODO[m] } : {}) })
  }

  function validar() {
    if (!(montoNum > 0)) return 'Escribe el monto.'
    if (moneda === 'Bs' && !(tasa > 0)) return 'Falta la tasa del día para convertir a dólares.'
    if (esCobrar && !f.cliente.trim()) return 'Escribe la empresa.'
    if (esCobrar && !textoProductos(f.cantidades, productos)) return 'Agrega al menos un producto a la orden.'
    if (tipo === 'gasto' && !f.categoria) return 'Elige una categoría.'
    if (f.capture?.estado === 'leyendo') return 'Espera a que termine de leer el capture.'
    return null
  }

  async function guardar(confirmarDuplicado = false) {
    const err = validar()
    if (err) { setError(err); vibrar('error'); return }
    setError(null)
    setGuardando(true)
    const productosTxt = textoProductos(f.cantidades, productos)
    const req = esCobrar
      ? {
          tipo, request_id: requestId.current, cliente: f.cliente.trim(), productos: productosTxt,
          monto: montoNum, moneda: 'USD', fecha_entrega: f.fecha, fecha_esperada_pago: f.fechaCobro,
        }
      : {
          tipo, request_id: requestId.current, fecha: f.fecha, monto: montoNum, moneda, tasa: moneda === 'Bs' ? tasa : tasaDia?.tasa || 0,
          tasa_editada: editTasa, monto_usd: montoUsd, monto_bs: moneda === 'Bs' ? montoNum : round2(montoNum * tasa),
          metodo: f.metodo, referencia: f.referencia.trim(),
          capture: f.capture?.blob || null, confirmar_duplicado: confirmarDuplicado,
          ...(tipo === 'venta'
            ? { cliente: f.cliente.trim(), productos: productosTxt, cantidad: cantidadTotal, banco: f.banco.trim() }
            : { categoria: f.categoria, concepto: f.concepto.trim(), proveedor: f.proveedor.trim() }),
        }
    try {
      const r = await api.registrar(req)
      vibrar('success')
      notify(esCobrar ? `Orden #${r.orden} guardada` : tipo === 'venta' ? 'Venta guardada' : 'Gasto guardado')
      requestId.current = uid()
      back()
    } catch (e) {
      if (e.status === 409 && e.data?.duplicado) {
        setDuplicado(e.data.duplicado)
      } else {
        setError(e.message)
        vibrar('error')
      }
    } finally {
      setGuardando(false)
    }
  }

  const aiCls = (k) => (f.ia[k] ? 'input ai' : 'input')

  return (
    <div className="screen">
      <TopBar title="Nuevo registro" onBack={back} />
      <div style={{ padding: '8px 20px 0' }}>
        <Segmented options={TIPOS} value={tipo} onChange={cambiarTipo} label="Tipo de registro" />
      </div>

      <main className="screen-body" style={{ paddingTop: 16 }}>
        {!esCobrar && (
          <CaptureField capture={f.capture} onChange={(c) => set({ capture: c, ...(c ? {} : { ia: {} }) })} onLeido={onLeido} />
        )}

        {esCobrar && (
          <div className="order-pill">
            <span>N° de orden</span>
            <strong>{proximo ? `#${proximo}` : '…'}</strong>
          </div>
        )}
        {esCobrar && <p className="hint" style={{ marginTop: -8 }}>El número se confirma al guardar.</p>}

        <div className={esCobrar ? 'grid-2' : 'monto-row'}>
          <label className="field">
            Monto{esCobrar ? ' ($)' : ''}
            <input className={`${aiCls('monto')} big`} inputMode="decimal" placeholder="0,00" value={montoTexto}
              onChange={(e) => set({ monto: e.target.value, montoManual: true, ia: { ...f.ia, monto: false } })} />
          </label>
          {esCobrar ? (
            <label className="field">
              Fecha de entrega
              <input className="input" type="date" value={f.fecha}
                onChange={(e) => set({ fecha: e.target.value, fechaCobro: viernesSiguiente(e.target.value || hoyISO()) })} />
            </label>
          ) : (
            <div className="field">
              <span>Moneda</span>
              <Segmented options={OPCIONES_MONEDA} value={f.moneda} onChange={(m) => set({ moneda: m })} label="Moneda" />
            </div>
          )}
        </div>

        {f.montoManual && totalUsd > 0 && Math.abs(montoNum - montoAuto) > 0.009 && (
          <p className="hint">
            Según catálogo: {formatMonto(montoAuto, moneda)} ·{' '}
            <button type="button" onClick={() => set({ montoManual: false, monto: '' })}
              style={{ border: 'none', background: 'none', padding: 0, textDecoration: 'underline', fontWeight: 700, fontSize: 13 }}>
              usar ese
            </button>
          </p>
        )}

        {!esCobrar && (
          <div className="notice" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {moneda === 'Bs' && montoNum > 0 && <strong>≈ {formatUsd(montoUsd)}</strong>}
            {!editTasa ? (
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span>
                  {tasaDia ? `Tasa BCV: ${formatBs(tasaDia.tasa)} · ${fechaCorta(tasaDia.fecha_valor)}` : 'Tasa BCV no disponible'}
                </span>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => { setEditTasa(true); setTasaManual(montoInput(tasaDia?.tasa || '')) }}>
                  Otra tasa
                </button>
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
                <label className="field" style={{ flex: 1 }}>
                  Tasa usada en este registro (Bs por $)
                  <input className="input" inputMode="decimal" value={tasaManual} onChange={(e) => setTasaManual(e.target.value)} />
                </label>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setEditTasa(false)}>Usar BCV</button>
              </span>
            )}
          </div>
        )}

        {!esCobrar && (
          <label className="field">
            Fecha
            <input className={aiCls('fecha')} type="date" value={f.fecha} max={hoyISO()} onChange={(e) => set({ fecha: e.target.value })} />
          </label>
        )}

        {esCobrar && (
          <label className="field">
            Fecha de cobro
            <input className="input" type="date" value={f.fechaCobro} onChange={(e) => set({ fechaCobro: e.target.value })} />
          </label>
        )}

        {tipo !== 'gasto' && (
          <label className="field">
            {esCobrar ? 'Empresa' : 'Cliente'}
            <input className="input" placeholder="Nombre" value={f.cliente} onChange={(e) => set({ cliente: e.target.value })} autoComplete="off" />
          </label>
        )}

        {tipo === 'gasto' && (
          <>
            <div className="field">
              <span>Categoría</span>
              <Chips options={CATEGORIAS_GASTO} value={f.categoria} onChange={(c) => set({ categoria: c })} label="Categoría" />
            </div>
            <label className="field">
              Concepto
              <input className="input" placeholder="Ej. compra de harina y mantequilla" value={f.concepto} onChange={(e) => set({ concepto: e.target.value })} />
            </label>
            <label className="field">
              Proveedor
              <input className="input" placeholder="Opcional" value={f.proveedor} onChange={(e) => set({ proveedor: e.target.value })} />
            </label>
          </>
        )}

        {tipo !== 'gasto' && (
          <ProductPicker productos={productos} cantidades={f.cantidades} onChange={(c) => set({ cantidades: c })} total={totalUsd} />
        )}

        {!esCobrar && (
          <>
            <div className="field">
              <span>Método de pago</span>
              <Chips grid options={METODOS} value={f.metodo} onChange={elegirMetodo} label="Método de pago" />
            </div>
            <div className={tipo === 'venta' && METODOS_CON_BANCO.includes(f.metodo) ? 'grid-2' : ''}>
              <label className="field">
                Referencia
                <input className={aiCls('referencia')} inputMode="numeric" placeholder="N° de operación" value={f.referencia}
                  onChange={(e) => set({ referencia: e.target.value, ia: { ...f.ia, referencia: false } })} />
              </label>
              {tipo === 'venta' && METODOS_CON_BANCO.includes(f.metodo) && (
                <label className="field">
                  Banco
                  <input className={aiCls('banco')} placeholder="Ej. Banesco" value={f.banco}
                    onChange={(e) => set({ banco: e.target.value, ia: { ...f.ia, banco: false } })} />
                </label>
              )}
            </div>
          </>
        )}

        {error && <div className="notice warn" role="alert"><strong>Revisa el formulario</strong>{error}</div>}
      </main>

      <div className="bottom-bar">
        <button className="btn btn-primary btn-block btn-lg" disabled={guardando || (tasaCargando && !esCobrar)} onClick={() => guardar(false)}>
          {guardando ? 'Guardando…' : tasaCargando && !esCobrar ? 'Cargando tasa…' : BOTON[tipo]}
        </button>
      </div>

      {duplicado && (
        <Sheet title="Referencia repetida" onClose={() => setDuplicado(null)}>
          <div className="notice warn">
            <strong><Icon name="alert" size={18} style={{ verticalAlign: -3 }} /> Ya existe un {duplicado.tipo} con la referencia {f.referencia}</strong>
            {fechaCorta(duplicado.fecha)} · {formatMonto(duplicado.monto, duplicado.moneda)}{duplicado.cliente ? ` · ${duplicado.cliente}` : ''}
          </div>
          <p className="hint">Puede ser el mismo pago registrado dos veces (por la app o por el bot).</p>
          <button className="btn btn-outline btn-block btn-lg" onClick={() => setDuplicado(null)}>Revisar</button>
          <button className="btn btn-danger btn-block" onClick={() => { setDuplicado(null); guardar(true) }}>Guardar de todas formas</button>
        </Sheet>
      )}
    </div>
  )
}
