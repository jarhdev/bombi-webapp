import { useCallback, useEffect, useRef, useState } from 'react'
import { api, USE_MOCKS } from './api/index.js'
import { clearSession, getSession, saveSession } from './api/session.js'
import { botonAtras, enTelegram, initData } from './telegram/tg.js'
import { Toast, Spinner } from './components/ui.jsx'
import Resumen from './screens/Resumen.jsx'
import Registro from './screens/Registro.jsx'
import PorCobrar from './screens/PorCobrar.jsx'
import Inventario from './screens/Inventario.jsx'
import Ajustes, { Productos, Tasa, Usuarios } from './screens/Ajustes.jsx'
import { Login, Mensaje } from './screens/Login.jsx'

export default function App() {
  const [sesion, setSesion] = useState(() => getSession())
  const [estadoAuth, setEstadoAuth] = useState(sesion ? 'ok' : enTelegram ? 'cargando' : 'login')
  const [pila, setPila] = useState([{ name: 'resumen' }])
  const [productos, setProductos] = useState([])
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const notify = useCallback((text, error = false) => {
    clearTimeout(toastTimer.current)
    setToast({ text, error })
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const entrar = useCallback((r) => {
    if (r.estado === 'pendiente') return setEstadoAuth('pendiente')
    if (r.estado !== 'activo') return setEstadoAuth('inactivo')
    saveSession(r)
    setSesion(getSession())
    setEstadoAuth('ok')
  }, [])

  // Dentro de Telegram se entra solo con initData (n8n valida la firma).
  useEffect(() => {
    if (estadoAuth !== 'cargando') return
    api.auth({ initData }).then(entrar).catch(() => setEstadoAuth('login'))
  }, [estadoAuth, entrar])

  useEffect(() => {
    if (estadoAuth !== 'ok') return
    api.productos().then((d) => setProductos(d.productos)).catch((e) => notify(e.message, true))
  }, [estadoAuth, notify])

  const logout = useCallback(() => {
    clearSession()
    setSesion(null)
    setPila([{ name: 'resumen' }])
    setEstadoAuth('login')
  }, [])

  // Si el servidor responde 401, la sesión se borra: volver al login.
  useEffect(() => {
    const t = setInterval(() => { if (estadoAuth === 'ok' && !getSession()) logout() }, 2000)
    return () => clearInterval(t)
  }, [estadoAuth, logout])

  const go = useCallback((name, params = {}) => { setPila((p) => [...p, { name, params }]); window.scrollTo(0, 0) }, [])
  const back = useCallback(() => { setPila((p) => (p.length > 1 ? p.slice(0, -1) : p)); window.scrollTo(0, 0) }, [])
  const actual = pila[pila.length - 1]

  useEffect(() => botonAtras(pila.length > 1 ? back : null), [pila.length, back])

  let contenido
  if (estadoAuth === 'cargando') contenido = <Mensaje titulo="Entrando…" texto={<Spinner />} />
  else if (estadoAuth === 'pendiente')
    contenido = <Mensaje titulo="Solicitud enviada" texto="Un admin tiene que aprobar tu acceso. Te avisaremos por Telegram." />
  else if (estadoAuth === 'inactivo') contenido = <Mensaje titulo="Acceso desactivado" texto="Pídele a un admin que active tu usuario." />
  else if (estadoAuth === 'login' || !sesion) contenido = <Login onLogin={entrar} />
  else {
    const u = sesion.usuario
    const comun = { usuario: u, go, back, notify }
    const p = actual.params || {}
    switch (actual.name) {
      case 'registro': contenido = <Registro key={pila.length} {...comun} tipoInicial={p.tipo} productos={productos} />; break
      case 'cobrar': contenido = <PorCobrar {...comun} />; break
      case 'inventario': contenido = <Inventario {...comun} />; break
      case 'ajustes': contenido = <Ajustes {...comun} logout={logout} />; break
      case 'usuarios': contenido = u.rol === 'admin' ? <Usuarios {...comun} /> : null; break
      case 'productos': contenido = u.rol === 'admin' ? <Productos {...comun} productos={productos} onSaved={setProductos} /> : null; break
      case 'tasa': contenido = u.rol === 'admin' ? <Tasa {...comun} /> : null; break
      default: contenido = <Resumen key={pila.length} {...comun} />
    }
  }

  return (
    <>
      {USE_MOCKS && <div className="demo-banner">Modo demo · datos de prueba guardados solo en este teléfono</div>}
      {contenido}
      <Toast toast={toast} />
    </>
  )
}
