import { useRef } from 'react'
import Icon from './Icon.jsx'
import { Spinner } from './ui.jsx'
import { api } from '../api/index.js'
import { comprimirImagen, validarImagen, TIPOS_PERMITIDOS } from '../lib/image.js'
import { MAX_CAPTURES } from '../lib/captures.js'
import { formatMonto } from '../lib/format.js'

// Zona para adjuntar uno o varios captures del mismo pago (si se pagó en partes).
// Comprime cada imagen y la manda a leer con IA; lo leído queda en capture.datos.
// Si la IA falla, no bloquea: se llena a mano.
//   captures = [{ key, blob, dataUrl, estado: 'leyendo'|'leido'|'manual'|'error', mensaje, datos }]
//   onChange(fn) recibe una función (lista anterior → lista nueva), porque varias lecturas pueden terminar a la vez.
let siguiente = 0

export default function CaptureField({ captures, onChange }) {
  const input = useRef(null)
  const reemplazar = useRef(null) // key del capture que se está cambiando, o null para agregar

  const actualizar = (key, patch) => onChange((l) => l.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  async function elegir(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const key = reemplazar.current ?? ++siguiente
    const nuevo = reemplazar.current === null
    reemplazar.current = null
    const poner = (patch) => onChange((l) => (l.some((c) => c.key === key) ? l.map((c) => (c.key === key ? { key, ...patch } : c)) : nuevo ? [...l, { key, ...patch }] : l))
    const err = validarImagen(file)
    if (err) return poner({ blob: null, dataUrl: null, estado: 'error', mensaje: err })
    let img
    try {
      img = await comprimirImagen(file)
    } catch {
      return poner({ blob: null, dataUrl: null, estado: 'error', mensaje: 'No se pudo abrir la imagen.' })
    }
    poner({ ...img, estado: 'leyendo', mensaje: 'Leyendo capture…', datos: null })
    try {
      const datos = await api.leerCapture(img.blob)
      actualizar(key, { estado: 'leido', mensaje: 'Leído por IA · revisa los datos', datos })
    } catch {
      actualizar(key, { estado: 'manual', mensaje: 'No se pudo leer. Llena los datos a mano.' })
    }
  }

  const abrir = (key = null) => { reemplazar.current = key; input.current?.click() }
  const quitar = (key) => onChange((l) => l.filter((c) => c.key !== key))

  const picker = (
    <input ref={input} type="file" accept={TIPOS_PERMITIDOS.join(',')} className="sr-only" onChange={elegir} tabIndex={-1} aria-hidden="true" />
  )
  const lista = captures.filter((c) => c.dataUrl)
  const error = captures.find((c) => c.estado === 'error')
  const varios = lista.length > 1

  if (!lista.length) {
    return (
      <>
        {picker}
        <button type="button" className="capture-drop" onClick={() => { if (error) quitar(error.key); abrir() }}>
          <Icon name="camera" size={28} />
          <strong>Adjuntar capture</strong>
          <span>{error ? error.mensaje : 'La IA llena monto y referencia por ti'}</span>
        </button>
      </>
    )
  }

  return (
    <div className="captures">
      {picker}
      {lista.map((c, i) => (
        <div className="capture-file" key={c.key}>
          <img src={c.dataUrl} alt={`Capture ${i + 1}`} />
          <div className="txt">
            <strong>{varios ? `Capture ${i + 1}` : 'Capture del pago'}</strong>
            <span style={{ color: c.estado === 'leido' ? 'var(--accent)' : 'inherit' }}>
              {c.estado === 'leyendo' && <><Spinner /> </>}
              {varios && c.estado === 'leido' && c.datos
                ? [c.datos.monto > 0 && formatMonto(c.datos.monto, c.datos.moneda || 'Bs'), c.datos.referencia && `Ref ${c.datos.referencia}`].filter(Boolean).join(' · ') || c.mensaje
                : c.mensaje}
            </span>
            <button type="button" className="btn-link" onClick={() => abrir(c.key)}
              style={{ border: 'none', background: 'none', padding: '4px 0 0', textAlign: 'left', fontWeight: 700, textDecoration: 'underline', fontSize: 13, minHeight: 0 }}>
              Cambiar imagen
            </button>
          </div>
          <button type="button" className="remove" aria-label={`Quitar capture ${i + 1}`} onClick={() => quitar(c.key)}>
            <Icon name="x" size={18} />
          </button>
        </div>
      ))}
      {error && <p className="hint accent" role="alert">{error.mensaje}</p>}
      {lista.length < MAX_CAPTURES && (
        <button type="button" className="btn btn-soft btn-block" onClick={() => { if (error) quitar(error.key); abrir() }}>
          <Icon name="camera" size={18} /> Agregar otro capture
        </button>
      )}
      {lista.length === 1 && <p className="hint" style={{ marginTop: -4 }}>¿Pagó en partes? Agrega cada capture y se suman.</p>}
    </div>
  )
}

// Aviso bajo el monto cuando hay varios captures: suma, captures sin leer o monedas mezcladas.
export function AvisoCaptures({ lectura }) {
  if (lectura.monedasDistintas)
    return <div className="notice warn" role="alert">Los captures son de monedas distintas (Bs y $). Regístralos como ventas o abonos separados.</div>
  if (lectura.leyendo) return <p className="hint">Leyendo los captures…</p>
  if (lectura.sinLeer)
    return <div className="notice warn" role="status">{lectura.sinLeer === 1 ? 'Un capture no se pudo leer' : `${lectura.sinLeer} captures no se pudieron leer`}: escribe el total de los {lectura.cantidad} pagos y sus referencias a mano.</div>
  return <p className="hint accent">Total de {lectura.cantidad} captures sumados. Las referencias quedan juntas, separadas por “/”.</p>
}
