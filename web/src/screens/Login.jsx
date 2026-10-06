import { useState } from 'react'
import { api, USE_MOCKS } from '../api/index.js'

export function Login({ onLogin }) {
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    if (!nombre.trim() || pin.length < 4) return setError('Escribe tu nombre y tu PIN.')
    setCargando(true)
    setError(null)
    try {
      onLogin(await api.auth({ nombre: nombre.trim(), pin }))
    } catch (err) {
      setError(err.message)
      setPin('')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form className="login" onSubmit={entrar}>
      <div className="brand">
        <span className="logo"><img src="/logo.svg" alt="" /></span>
        <h1>Bombi · Control</h1>
        <p>Ventas, gastos y cuentas por cobrar</p>
      </div>
      <label className="field">
        Nombre
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="username" autoCapitalize="words" />
      </label>
      <label className="field">
        PIN
        <input className="input pin-input" type="password" inputMode="numeric" maxLength={6} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoComplete="current-password" />
      </label>
      {error && <div className="notice warn" role="alert">{error}</div>}
      <button className="btn btn-primary btn-block btn-lg" disabled={cargando}>{cargando ? 'Entrando…' : 'Entrar'}</button>
      {USE_MOCKS && <p className="hint" style={{ textAlign: 'center' }}>Modo demo: entra como <b>Jose</b> con PIN <b>1234</b> (admin) o <b>Vendedor</b> con <b>5678</b>.</p>}
    </form>
  )
}

export function Mensaje({ titulo, texto, accion }) {
  return (
    <div className="screen">
      <div className="center-msg">
        <span className="logo" style={{ width: 96, height: 96 }}><img src="/logo.svg" alt="" /></span>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>{titulo}</h1>
        <p>{texto}</p>
        {accion}
      </div>
    </div>
  )
}
