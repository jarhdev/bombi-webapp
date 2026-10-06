import { useEffect } from 'react'
import Icon from './Icon.jsx'

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chips({ options, value, onChange, grid = false, label }) {
  return (
    <div className={`chips${grid ? ' grid' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, onChange, label, sub }) {
  return (
    <div className={`stepper${value > 0 ? ' on' : ''}`}>
      <button type="button" aria-label={`Quitar ${label}`} onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}>
        <Icon name="minus" size={18} stroke={2.4} />
      </button>
      <span className="stepper-label">
        <span className="val" aria-live="polite" aria-label={`${value} ${label}`}>{value}</span>
        {sub && <small>{sub}</small>}
      </span>
      <button type="button" aria-label={`Agregar ${label}`} onClick={() => onChange(value + 1)}>
        <Icon name="plus" size={18} stroke={2.4} />
      </button>
    </div>
  )
}

export function TopBar({ title, onBack, right }) {
  return (
    <header className="topbar">
      {onBack && (
        <button className="icon-btn" aria-label="Volver" onClick={onBack}>
          <Icon name="back" />
        </button>
      )}
      <h1>{title}</h1>
      <span className="spacer" />
      {right}
    </header>
  )
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <span className="grab" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div className={`toast${toast.error ? ' error' : ''}`} role="status">
      <Icon name={toast.error ? 'alert' : 'check'} size={20} stroke={2.4} />
      {toast.text}
    </div>
  )
}

export function Spinner() {
  return <span className="spin" aria-hidden="true" />
}
