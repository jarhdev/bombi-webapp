import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Chips, Segmented, Sheet, Spinner, TopBar } from '../components/ui.jsx'
import CaptureField from '../components/CaptureField.jsx'
import { api } from '../api/index.js'
import { formatBs, formatMonto, formatUsd, montoInput, parseMonto, round2, toUsd } from '../lib/format.js'
import { fechaCorta, hoyISO, nombreDia } from '../lib/dates.js'
import { METODOS, MONEDA_POR_METODO, MONEDAS } from '../lib/constantes.js'
import { uid } from '../lib/uid.js'
import { vibrar } from '../telegram/tg.js'

export default function PorCobrar({ back, go, notify }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [pagando, setPagando] = useState(null)

  const cargar = useCallback(() => {
    setError(null)
    api.porCobrar().then(setData).catch((e) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  const hoy = hoyISO()

  return (
    <div className="screen">
      <TopBar title="Por cobrar" onBack={back} />
      <main className="screen-body">
        <section className="dark-card">
          <div className="l">
            <span>Total pendiente</span>
            <strong>{data ? formatUsd(data.total_usd) : '…'}</strong>
          </div>
          <div className="r">
            <span>Cobro</span>
            <strong>Viernes</strong>
          </div>
        </section>

        {error && <div className="notice warn"><strong>No se pudo cargar</strong>{error}</div>}
        {!data && !error && <div className="empty"><Spinner /> Cargando…</div>}
        {data?.ordenes.length === 0 && <div className="card empty">No hay órdenes pendientes.</div>}

        {data?.ordenes.map((o) => {
          const vencida = o.fecha_esperada_pago && o.fecha_esperada_pago < hoy
          return (
            <article className="order" key={o.orden}>
              <div className="head">
                <div className="l">
                  <span className="num">Orden #{o.orden}</span>
                  <span className="who">{o.cliente}</span>
                  <span className="meta">Entregada {nombreDia(o.fecha_entrega)} {fechaCorta(o.fecha_entrega)}{o.productos ? ` · ${o.productos}` : ''}</span>
                  <span className={`meta${vencida ? ' vencida' : ''}`}>
                    {vencida ? 'Vencida · ' : 'Cobro '}{nombreDia(o.fecha_esperada_pago)} {fechaCorta(o.fecha_esperada_pago)}
                  </span>
                </div>
                <span className="amt">{formatMonto(o.monto, o.moneda || '$')}</span>
              </div>
              <button className="btn btn-primary btn-block" onClick={() => setPagando(o)}>
                <Icon name="camera" size={18} /> Marcar pagada + capture
              </button>
            </article>
          )
        })}
      </main>

      <div className="bottom-bar">
        <button className="btn btn-outline btn-block btn-lg" onClick={() => go('registro', { tipo: 'cobrar' })}>
          + Nueva orden por cobrar
        </button>
      </div>

      {pagando && (
        <PagoSheet
          orden={pagando}
          onClose={() => setPagando(null)}
          onDone={() => {
            notify(`Orden #${pagando.orden} pagada · pasó a Ventas`)
            setPagando(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}

function PagoSheet({ orden, onClose, onDone }) {
  const [capture, setCapture] = useState(null)
  const [tasaDia, setTasaDia] = useState(null)
  const [tasaTxt, setTasaTxt] = useState('')
  const [moneda, setMoneda] = useState('Bs')
  const [monto, setMonto] = useState('')
  const [montoManual, setMontoManual] = useState(false)
  const [referencia, setReferencia] = useState('')
  const [metodo, setMetodo] = useState('Pago móvil')
  const [fecha, setFecha] = useState(hoyISO())
  const [ia, setIa] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [duplicado, setDuplicado] = useState(null)
  const requestId = useRef(uid())

  useEffect(() => {
    api.tasa().then((t) => {
      setTasaDia(t)
      setTasaTxt((prev) => prev || montoInput(t.tasa))
    }).catch(() => {})
  }, [])

  // La orden está en $; si pagan en Bs se convierte con la tasa del día del pago.
  const tasa = parseMonto(tasaTxt)
  const esperado = moneda === '$' ? orden.monto : round2(orden.monto * tasa)
  const montoTexto = montoManual ? monto : esperado > 0 ? montoInput(esperado) : ''
  const montoNum = parseMonto(montoTexto)
  const montoUsd = toUsd(montoNum, moneda, tasa)
  const diferencia = round2(montoUsd - orden.monto)

  function onLeido(d) {
    const nuevo = {}
    if (d.monto) { setMonto(montoInput(d.monto)); setMontoManual(true); nuevo.monto = true }
    if (d.moneda && MONEDAS.includes(d.moneda)) setMoneda(d.moneda)
    if (d.referencia) { setReferencia(String(d.referencia)); nuevo.referencia = true }
    if (d.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) setFecha(d.fecha)
    if (d.metodo && METODOS.includes(d.metodo)) setMetodo(d.metodo)
    setIa(nuevo)
  }

  async function confirmar(confirmarDuplicado = false) {
    if (!(montoNum > 0)) return setError('Escribe el monto pagado.')
    if (moneda === 'Bs' && !(tasa > 0)) return setError('Falta la tasa del día.')
    if (capture?.estado === 'leyendo') return setError('Espera a que termine de leer el capture.')
    setError(null)
    setGuardando(true)
    try {
      await api.cobrar({
        request_id: requestId.current, orden: orden.orden, fecha, monto: montoNum, moneda, tasa,
        tasa_editada: tasaDia ? tasa !== tasaDia.tasa : true, monto_usd: montoUsd, metodo,
        referencia: referencia.trim(), capture: capture?.blob || null, confirmar_duplicado: confirmarDuplicado,
      })
      vibrar('success')
      onDone()
    } catch (e) {
      if (e.status === 409 && e.data?.duplicado) setDuplicado(e.data.duplicado)
      else { setError(e.message); vibrar('error') }
    } finally {
      setGuardando(false)
    }
  }

  if (duplicado) {
    return (
      <Sheet title="Referencia repetida" onClose={() => setDuplicado(null)}>
        <div className="notice warn">
          <strong>Ya existe un {duplicado.tipo} con la referencia {referencia}</strong>
          {fechaCorta(duplicado.fecha)} · {formatMonto(duplicado.monto, duplicado.moneda)}{duplicado.cliente ? ` · ${duplicado.cliente}` : ''}
        </div>
        <button className="btn btn-outline btn-block btn-lg" onClick={() => setDuplicado(null)}>Revisar</button>
        <button className="btn btn-danger btn-block" onClick={() => { setDuplicado(null); confirmar(true) }}>Guardar de todas formas</button>
      </Sheet>
    )
  }

  return (
    <Sheet title={`Cobrar orden #${orden.orden}`} onClose={onClose}>
      <div className="notice">
        <strong>{orden.cliente} · {formatUsd(orden.monto)}</strong>
        {orden.productos}
      </div>

      <CaptureField capture={capture} onChange={(c) => { setCapture(c); if (!c) setIa({}) }} onLeido={onLeido} />

      <div className="monto-row">
        <label className="field">
          Monto pagado
          <input className={`input big${ia.monto ? ' ai' : ''}`} inputMode="decimal" value={montoTexto}
            onChange={(e) => { setMonto(e.target.value); setMontoManual(true); setIa({ ...ia, monto: false }) }} />
        </label>
        <div className="field">
          <span>Moneda</span>
          <Segmented options={MONEDAS.map((m) => ({ value: m, label: m }))} value={moneda} onChange={(m) => { setMoneda(m); setMontoManual(false) }} label="Moneda" />
        </div>
      </div>

      {moneda === 'Bs' && (
        <label className="field">
          Tasa del día del pago (Bs por $)
          <input className="input" inputMode="decimal" value={tasaTxt} onChange={(e) => { setTasaTxt(e.target.value); setMontoManual(false) }} />
          {tasaDia && <span className="hint">BCV: {formatBs(tasaDia.tasa)} · {fechaCorta(tasaDia.fecha_valor)}</span>}
        </label>
      )}

      {montoNum > 0 && (
        <div className={`notice${Math.abs(diferencia) >= 0.5 ? ' warn' : ''}`}>
          <strong>
            {moneda === 'Bs' ? `≈ ${formatUsd(montoUsd)}` : formatUsd(montoUsd)}
            {Math.abs(diferencia) < 0.5 ? ' · coincide con la orden' : ` · ${diferencia > 0 ? 'sobran' : 'faltan'} ${formatUsd(Math.abs(diferencia))}`}
          </strong>
          {Math.abs(diferencia) >= 0.5 && 'El monto no coincide con la orden. Revísalo antes de confirmar.'}
        </div>
      )}

      <div className="field">
        <span>Método de pago</span>
        <Chips grid options={METODOS} value={metodo} onChange={(m) => { setMetodo(m); if (MONEDA_POR_METODO[m]) { setMoneda(MONEDA_POR_METODO[m]); setMontoManual(false) } }} label="Método de pago" />
      </div>
      <div className="grid-2">
        <label className="field">
          Referencia
          <input className={`input${ia.referencia ? ' ai' : ''}`} inputMode="numeric" value={referencia} onChange={(e) => { setReferencia(e.target.value); setIa({ ...ia, referencia: false }) }} />
        </label>
        <label className="field">
          Fecha del pago
          <input className="input" type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} />
        </label>
      </div>

      {error && <div className="notice warn" role="alert">{error}</div>}

      <button className="btn btn-primary btn-block btn-lg" disabled={guardando} onClick={() => confirmar(false)}>
        {guardando ? 'Guardando…' : 'Confirmar pago'}
      </button>
      <button className="btn btn-outline btn-block" onClick={onClose}>Cancelar</button>
    </Sheet>
  )
}
