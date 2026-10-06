import { agruparCatalogo } from '../lib/productos.js'
import { formatUsd } from '../lib/format.js'
import { Stepper } from './ui.jsx'

// Selector de productos. Las NY Cookies tienen dos selectores por fila (100g y 160g):
// una sola toca por galleta, sin tener que cambiar primero la presentación.
export default function ProductPicker({ productos, cantidades, onChange, total }) {
  const { ny, otros } = agruparCatalogo(productos)
  const set = (id, n) => onChange({ ...cantidades, [id]: n })

  return (
    <div className="field" role="group" aria-label="Productos">
      <span>Productos</span>
      <div className="prod-box">
        {ny.length > 0 && <div className="prod-group">NY Cookies</div>}
        {ny.map(({ sabor, variantes }) => (
          <div className="prod-row" key={sabor}>
            <div className="name">
              <strong>{sabor.replace(/^NY /, '')}</strong>
              <span>{variantes.map((v) => formatUsd(v.precio)).join(" · ")}</span>
            </div>
            <div className="ny-steppers">
              {variantes.map((v) => (
                <Stepper key={v.id} value={cantidades[v.id] || 0} onChange={(n) => set(v.id, n)}
                  label={`${sabor} ${v.presentacion}`} sub={v.presentacion} />
              ))}
            </div>
          </div>
        ))}
        {otros.length > 0 && <div className="prod-group">Otros</div>}
        {otros.map((p) => (
          <div className="prod-row" key={p.id}>
            <div className="name">
              <strong>{p.nombre}</strong>
              <span>{p.presentacion} · {formatUsd(p.precio)}</span>
            </div>
            <Stepper value={cantidades[p.id] || 0} onChange={(n) => set(p.id, n)} label={`${p.nombre} ${p.presentacion}`} />
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="prod-total">
          <span>Total según catálogo</span>
          <strong>{formatUsd(total)}</strong>
        </div>
      )}
    </div>
  )
}
