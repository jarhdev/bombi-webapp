import { useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Segmented, Sheet, Spinner } from '../components/ui.jsx'
import { api } from '../api/index.js'
import { formatUsd, formatBs } from '../lib/format.js'
import { fechaCorta, fechaRelativa } from '../lib/dates.js'

const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
]
const ETIQUETA = { hoy: 'de hoy', semana: 'de la semana', mes: 'del mes' }

export default function Resumen({ usuario, go, notify }) {
  const [periodo, setPeriodo] = useState(() => sessionStorage.getItem('bombi-periodo') || 'hoy')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [anulando, setAnulando] = useState(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    setError(null)
    try { sessionStorage.setItem('bombi-periodo', periodo) } catch { /* */ }
    api.resumen(periodo).then((d) => vivo && setData(d)).catch((e) => vivo && setError(e.message))
    return () => { vivo = false }
  }, [periodo, recarga])

  const esAdmin = usuario.rol === 'admin'

  async function anular() {
    try {
      await api.anular({ tipo: anulando.tipo, id: anulando.id })
      notify('Registro anulado')
      setAnulando(null)
      setRecarga((n) => n + 1)
    } catch (e) {
      notify(e.message, true)
    }
  }

  return (
    <div className="screen">
      <header className="hello">
        <div className="hello-id">
          <span className="logo"><img src="/logo.png" alt="" /></span>
          <div className="hello-text">
            <small>Hola, {usuario.nombre}</small>
            <strong>Bombi · Control</strong>
          </div>
        </div>
        <button className="icon-btn" aria-label="Ajustes" onClick={() => go('ajustes')}>
          <Icon name="settings" />
        </button>
      </header>

      <main className="screen-body">
        <Segmented options={PERIODOS} value={periodo} onChange={setPeriodo} label="Periodo" />

        {error && <div className="notice warn"><strong>No se pudo cargar el resumen</strong>{error}</div>}

        <section className="profit" aria-live="polite">
          <span className="label">Ganancia {ETIQUETA[periodo]}</span>
          <span className="big">{data ? formatUsd(data.ganancia_usd) : '…'}</span>
          <div className="minis">
            <div className="mini"><span>Ventas</span><strong>{data ? formatUsd(data.ventas_usd) : '…'}</strong></div>
            <div className="mini"><span>Gastos</span><strong>{data ? formatUsd(data.gastos_usd) : '…'}</strong></div>
          </div>
        </section>

        <button className="link-card" onClick={() => go('cobrar')}>
          <span className="badge"><Icon name="clock" /></span>
          <span className="txt">
            <strong>Por cobrar</strong>
            <span>
              {data
                ? `${data.por_cobrar.cantidad} ${data.por_cobrar.cantidad === 1 ? 'orden pendiente' : 'órdenes pendientes'} · ${formatUsd(data.por_cobrar.total_usd)}`
                : 'Cargando…'}
            </span>
          </span>
          <Icon name="chevron" size={20} />
        </button>

        <button className={`link-card${data?.inventario_bajo?.length ? ' alerta' : ''}`} onClick={() => go('inventario')}>
          <span className="badge"><Icon name={data?.inventario_bajo?.length ? 'alert' : 'box'} /></span>
          <span className="txt">
            <strong>Inventario</strong>
            <span>
              {!data ? 'Cargando…'
                : data.inventario_bajo?.length
                  ? `Poco stock: ${data.inventario_bajo.slice(0, 3).map((p) => `${p.nombre} (${p.stock})`).join(', ')}${data.inventario_bajo.length > 3 ? '…' : ''}`
                  : 'Galletas sin hornear y vendidos por semana'}
            </span>
          </span>
          <Icon name="chevron" size={20} />
        </button>

        <h2 className="section-title">Registrar</h2>
        <div className="quick">
          <button className="dark" onClick={() => go('registro', { tipo: 'venta' })}><Icon name="up" size={24} />Venta</button>
          <button onClick={() => go('registro', { tipo: 'gasto' })}><Icon name="down" size={24} />Gasto</button>
          <button className="tan" onClick={() => go('registro', { tipo: 'cobrar' })}><Icon name="doc" size={24} />Por cobrar</button>
        </div>

        <h2 className="section-title">Últimos registros</h2>
        <div className="list">
          {!data && !error && <div className="empty"><Spinner /> Cargando…</div>}
          {data?.ultimos.length === 0 && <div className="empty">Todavía no hay registros.</div>}
          {data?.ultimos.map((m) => {
            const contenido = (
              <>
                <span className={`dot ${m.tipo}`} aria-hidden="true" />
                <span className="txt">
                  <strong>{m.titulo}</strong>
                  <span>{m.anulado ? 'Anulado · ' : ''}{fechaRelativa(m.registrado || m.fecha)}{m.registrado && m.registrado !== m.fecha ? ` · pago del ${fechaCorta(m.fecha)}` : ''}{m.detalle ? ` · ${m.detalle}` : ''}</span>
                </span>
                <span className={`amt${m.tipo === 'gasto' ? ' neg' : ''}`}>
                  {m.tipo === 'venta' ? '+' : m.tipo === 'gasto' ? '−' : ''}{formatUsd(m.monto_usd)}
                </span>
              </>
            )
            const cls = `row${m.anulado ? ' anulado' : ''}`
            return esAdmin && !m.anulado ? (
              <button key={m.id} className={`${cls} as-btn`} onClick={() => setAnulando(m)} aria-label={`${m.titulo}, opciones`}>
                {contenido}
              </button>
            ) : (
              <div key={m.id} className={cls}>{contenido}</div>
            )
          })}
        </div>

        {data?.tasa && (
          <p className="rate-line">
            <Icon name="rate" size={16} />
            Tasa BCV: {formatBs(data.tasa.tasa)} · {fechaCorta(data.tasa.fecha_valor)}
          </p>
        )}
      </main>

      {anulando && (
        <Sheet title="¿Anular este registro?" onClose={() => setAnulando(null)}>
          <div className="notice">
            <strong>{anulando.titulo}</strong>
            {fechaCorta(anulando.fecha)} · {formatUsd(anulando.monto_usd)}
          </div>
          <p className="hint">La fila no se borra de la hoja: queda marcada como anulada y deja de contar en los totales.</p>
          <button className="btn btn-primary btn-block btn-lg" onClick={anular}>
            <Icon name="trash" size={20} /> Anular registro
          </button>
          <button className="btn btn-outline btn-block" onClick={() => setAnulando(null)}>Cancelar</button>
        </Sheet>
      )}
    </div>
  )
}
