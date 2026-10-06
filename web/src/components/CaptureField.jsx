import { useRef } from 'react'
import Icon from './Icon.jsx'
import { Spinner } from './ui.jsx'
import { api } from '../api/index.js'
import { comprimirImagen, validarImagen, TIPOS_PERMITIDOS } from '../lib/image.js'

// Zona para adjuntar el capture. Comprime la imagen, la manda a leer con IA
// y entrega los datos leídos con onLeido(). Si la IA falla, no bloquea: se llena a mano.
//   capture = null | { blob, dataUrl, estado: 'leyendo'|'leido'|'manual', mensaje }
export default function CaptureField({ capture, onChange, onLeido }) {
  const input = useRef(null)
  const turno = useRef(0)

  async function elegir(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validarImagen(file)
    if (err) {
      onChange({ blob: null, dataUrl: null, estado: 'error', mensaje: err })
      return
    }
    const mio = ++turno.current
    let img
    try {
      img = await comprimirImagen(file)
    } catch {
      onChange({ blob: null, dataUrl: null, estado: 'error', mensaje: 'No se pudo abrir la imagen.' })
      return
    }
    onChange({ ...img, estado: 'leyendo', mensaje: 'Leyendo capture…' })
    try {
      const datos = await api.leerCapture(img.blob)
      if (mio !== turno.current) return
      onChange({ ...img, estado: 'leido', mensaje: 'Leído por IA · revisa los datos' })
      onLeido?.(datos)
    } catch {
      if (mio !== turno.current) return
      onChange({ ...img, estado: 'manual', mensaje: 'No se pudo leer. Llena los datos a mano.' })
    }
  }

  function quitar() {
    turno.current++
    onChange(null)
  }

  const picker = (
    <input ref={input} type="file" accept={TIPOS_PERMITIDOS.join(',')} className="sr-only" onChange={elegir} tabIndex={-1} aria-hidden="true" />
  )

  if (!capture?.dataUrl) {
    return (
      <>
        {picker}
        <button type="button" className="capture-drop" onClick={() => input.current?.click()}>
          <Icon name="camera" size={28} />
          <strong>Adjuntar capture</strong>
          <span>{capture?.estado === 'error' ? capture.mensaje : 'La IA llena monto y referencia por ti'}</span>
        </button>
      </>
    )
  }

  return (
    <div className="capture-file">
      {picker}
      <img src={capture.dataUrl} alt="Capture adjunto" />
      <div className="txt">
        <strong>Capture del pago</strong>
        <span style={{ color: capture.estado === 'leido' ? 'var(--accent)' : 'inherit' }}>
          {capture.estado === 'leyendo' && <><Spinner /> </>}
          {capture.mensaje}
        </span>
        <button type="button" className="btn-link" onClick={() => input.current?.click()}
          style={{ border: 'none', background: 'none', padding: '4px 0 0', textAlign: 'left', fontWeight: 700, textDecoration: 'underline', fontSize: 13, minHeight: 0 }}>
          Cambiar imagen
        </button>
      </div>
      <button type="button" className="remove" aria-label="Quitar capture" onClick={quitar}>
        <Icon name="x" size={18} />
      </button>
    </div>
  )
}
