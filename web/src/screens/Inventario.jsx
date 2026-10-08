import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Chips, Sheet, Spinner, Stepper, TopBar } from '../components/ui.jsx'
import { api } from '../api/index.js'
import { fechaCorta, hoyISO, rangoPeriodo } from '../lib/dates.js'
import { uid } from '../lib/uid.js'
import { vibrar } from '../telegram/tg.js'

// Agrupa las galletas con inventario por sabor (NY Cookies 100g y 160g en la misma fila).
function porSabor(productos) {
  const m = new Map()
  for (const p of productos) {
    if (!m.has(p.sabor)) m.set(p.sabor, [])
    m.get(p.sabor).push(p)
  }
  return [...m.entries()].map(([sabor, vs]) => ({ sabor, variantes: vs.sort((a, b) => parseFloat(a.presentacion) - parseFloat(b.presentacion)) }))
}

export default function Inventario({ back, notify, usuario }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [modo, setModo] = useState(null) // 'entrada' | 'conteo'
  const [semana, setSemana] = useState(0)

  const cargar = useCallback(() => {
    setError(null)
    api.inventario().then(setData).catch((e) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  const bajos = data?.productos.filter((p) => p.bajo) || []
  const actual = rangoPeriodo('semana', hoyISO())[0]
  const etiquetaSemana = (s) => (s.desde === actual ? 'Esta semana' : `${fechaCorta(s.desde)} – ${fechaCorta(s.hasta)}`)
  const sem = data?.semanas[semana]
  const etiquetas = data?.semanas.map(etiquetaSemana) || []

  return (
    <div className="screen">
      <TopBar title="Inventario" onBack={back} />
      <main className="screen-body">
        {error && <div className="notice warn"><strong>No se pudo cargar</strong>{error}</div>}
        {!data && !error && <div className="empty"><Spinner /> Cargando…</div>}
        {data && !data.disponible && (
          <div className="notice warn"><strong>Falta preparar el Sheet</strong>Agrega las pestañas Inventario y Detalle ventas.</div>
        )}
        {bajos.length > 0 && (
          <div className="notice warn" role="status">
            <strong>{bajos.length === 1 ? '1 galleta con poco stock' : `${bajos.length} galletas con poco stock`}</strong>
            {bajos.length > 4 ? 'Están marcadas en rojo. Carga más con el botón de abajo.' : bajos.map((p) => `${p.nombre} (${p.stock})`).join(' · ')}
          </div>
        )}

        {data && (
          <section className="card stock">
            <div className="stock-head"><span>Galletas sin hornear</span><span>Mínimo {data.productos[0]?.minimo ?? 4}</span></div>
            {porSabor(data.productos).map(({ sabor, variantes }) => (
              <div className="stock-row" key={sabor}>
                <strong>{sabor}</strong>
                <div className="stock-pills">
                  {variantes.map((v) => (
                    <span key={v.id} className={`pill${v.bajo ? ' bajo' : ''}`} aria-label={`${v.nombre}: ${v.stock}`}>
                      <small>{v.presentacion}</small>{v.stock}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {data?.semanas.length > 0 && (
          <>
            <h2 className="section-title">Vendidos por semana</h2>
            <Chips options={etiquetas} value={etiquetas[semana]} onChange={(l) => setSemana(etiquetas.indexOf(l))} label="Semana" />
            <section className="card vendidos">
              {sem.productos.length === 0 && <div className="empty">Sin ventas registradas esta semana.</div>}
              {sem.productos.map((p) => (
                <div className="vend-row" key={p.id}><span>{p.nombre}</span><strong>{p.cantidad}</strong></div>
              ))}
              {sem.productos.length > 0 && <div className="vend-row total"><span>Total</span><strong>{sem.total}</strong></div>}
            </section>
          </>
        )}
      </main>

      {data?.disponible && (
        <div className="bottom-bar stack">
          <button className="btn btn-primary btn-block btn-lg" onClick={() => setModo('entrada')}>
            <Icon name="plus" size={20} /> Cargar galletas
          </button>
          {usuario.rol === 'admin' && (
            <button className="btn btn-outline btn-block" onClick={() => setModo('conteo')}>Corregir conteo</button>
          )}
        </div>
      )}

      {modo && (
        <MovimientoSheet modo={modo} productos={data.productos} onClose={() => setModo(null)}
          onDone={(r) => {
            notify(modo === 'entrada' ? 'Galletas cargadas al inventario' : r?.cambios ? 'Conteo corregido' : 'El conteo ya coincidía')
            setModo(null)
            cargar()
          }} />
      )}
    </div>
  )
}

function MovimientoSheet({ modo, productos, onClose, onDone }) {
  const conteo = modo === 'conteo'
  const [valores, setValores] = useState(() => (conteo ? Object.fromEntries(productos.map((p) => [p.id, String(p.stock)])) : {}))
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const requestId = useRef(uid())

  const items = conteo
    ? productos.filter((p) => valores[p.id] !== '' && Number(valores[p.id]) !== p.stock).map((p) => ({ id: p.id, cantidad: Number(valores[p.id]) }))
    : productos.filter((p) => valores[p.id] > 0).map((p) => ({ id: p.id, cantidad: valores[p.id] }))
  const total = items.reduce((s, i) => s + i.cantidad, 0)

  async function guardar() {
    if (!items.length) return setError(conteo ? 'No cambiaste ningún número.' : 'Agrega al menos una galleta.')
    if (conteo && items.some((i) => !Number.isInteger(i.cantidad) || i.cantidad < 0)) return setError('Escribe números enteros, sin negativos.')
    setError(null)
    setGuardando(true)
    try {
      const r = await api.inventarioMover({ tipo: modo, items, nota: nota.trim(), request_id: requestId.current })
      vibrar('success')
      onDone(r)
    } catch (e) {
      setError(e.message)
      vibrar('error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Sheet title={conteo ? 'Corregir conteo' : 'Cargar galletas'} onClose={onClose}>
      <p className="hint">{conteo
        ? 'Escribe cuántas galletas hay de verdad. Se guarda la diferencia como ajuste.'
        : 'Suma las galletas sin hornear que acaban de preparar.'}</p>
      <div className="prod-box">
        {porSabor(productos).map(({ sabor, variantes }) => (
          <div className="prod-row" key={sabor}>
            <div className="name"><strong>{sabor.replace(/^NY /, '')}</strong></div>
            <div className="ny-steppers">
              {variantes.map((v) => conteo ? (
                <label key={v.id} className="conteo">
                  <small>{v.presentacion}</small>
                  <input className="input" inputMode="numeric" value={valores[v.id] ?? ''} aria-label={`${v.nombre} contadas`}
                    onChange={(e) => setValores({ ...valores, [v.id]: e.target.value.replace(/\D/g, '') })} />
                </label>
              ) : (
                <Stepper key={v.id} value={valores[v.id] || 0} onChange={(n) => setValores({ ...valores, [v.id]: n })}
                  label={v.nombre} sub={variantes.length > 1 ? v.presentacion : undefined} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <label className="field">
        Nota (opcional)
        <input className="input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder={conteo ? 'Ej. se quemaron 2' : 'Ej. tanda del jueves'} />
      </label>
      {error && <div className="notice warn" role="alert">{error}</div>}
      <button className="btn btn-primary btn-block btn-lg" disabled={guardando} onClick={guardar}>
        {guardando ? 'Guardando…' : conteo ? `Guardar conteo${items.length ? ` (${items.length})` : ''}` : `Cargar ${total || ''} galletas`}
      </button>
    </Sheet>
  )
}
