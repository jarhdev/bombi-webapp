import { useCallback, useEffect, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { Segmented, Sheet, Spinner, TopBar } from '../components/ui.jsx'
import { api, USE_MOCKS } from '../api/index.js'
import { resetMock } from '../mocks/mockApi.js'
import { formatBs, formatUsd, montoInput, parseMonto } from '../lib/format.js'
import { fechaCorta } from '../lib/dates.js'
import { vibrar } from '../telegram/tg.js'

export default function Ajustes({ usuario, back, go, logout }) {
  const esAdmin = usuario.rol === 'admin'
  return (
    <div className="screen">
      <TopBar title="Ajustes" onBack={back} />
      <main className="screen-body">
        {esAdmin && (
          <nav className="menu-list" aria-label="Ajustes de admin">
            <button onClick={() => go('usuarios')}>
              <Icon name="users" /><span className="txt"><strong>Usuarios</strong><span>Agregar, aprobar, desactivar, cambiar PIN</span></span><Icon name="chevron" size={20} />
            </button>
            <button onClick={() => go('productos')}>
              <Icon name="box" /><span className="txt"><strong>Productos</strong><span>Activar, desactivar y cambiar precios</span></span><Icon name="chevron" size={20} />
            </button>
            <button onClick={() => go('tasa')}>
              <Icon name="rate" /><span className="txt"><strong>Tasa del día</strong><span>Tasa BCV automática y actualización manual</span></span><Icon name="chevron" size={20} />
            </button>
          </nav>
        )}
        <div className="card">
          <strong>{usuario.nombre}</strong> · {esAdmin ? 'Admin' : 'Usuario'}
        </div>
        <button className="btn btn-outline btn-block" onClick={logout}><Icon name="logout" size={20} /> Cerrar sesión</button>
        {USE_MOCKS && (
          <button className="btn btn-soft btn-block" onClick={() => { resetMock(); logout() }}>Reiniciar datos de prueba</button>
        )}
      </main>
    </div>
  )
}

// ---------------- Usuarios ----------------
export function Usuarios({ back, notify, usuario }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [nuevo, setNuevo] = useState(false)
  const [sel, setSel] = useState(null)

  const cargar = useCallback(() => {
    api.usuarios().then((d) => setLista(d.usuarios)).catch((e) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  async function accion(body, msg) {
    try {
      await api.usuarioAccion(body)
      vibrar('success')
      notify(msg)
      setSel(null)
      setNuevo(false)
      cargar()
    } catch (e) {
      notify(e.message, true)
    }
  }

  const orden = { pendiente: 0, activo: 1, inactivo: 2 }
  return (
    <div className="screen">
      <TopBar title="Usuarios" onBack={back} />
      <main className="screen-body">
        {error && <div className="notice warn">{error}</div>}
        {!lista && !error && <div className="empty"><Spinner /> Cargando…</div>}
        {lista && (
          <div className="list">
            {[...lista].sort((a, b) => orden[a.estado] - orden[b.estado]).map((u) => (
              <button key={u.id} className="row as-btn" onClick={() => setSel(u)}>
                <span className="txt">
                  <strong>{u.nombre}</strong>
                  <span>{u.telegram_id ? 'Telegram' : 'PIN'} · desde {fechaCorta(u.fecha_creacion)}</span>
                </span>
                {u.rol === 'admin' && <span className="tag admin">admin</span>}
                <span className={`tag ${u.estado}`}>{u.estado}</span>
              </button>
            ))}
          </div>
        )}
      </main>
      <div className="bottom-bar">
        <button className="btn btn-primary btn-block btn-lg" onClick={() => setNuevo(true)}><Icon name="plus" size={20} /> Agregar usuario</button>
      </div>

      {nuevo && <NuevoUsuario onClose={() => setNuevo(false)} onSave={(d) => accion({ accion: 'crear', ...d }, `${d.nombre} agregado`)} />}
      {sel && (
        <UsuarioSheet u={sel} yo={usuario} onClose={() => setSel(null)} onAccion={accion} />
      )}
    </div>
  )
}

const pinValido = (p) => /^\d{4,6}$/.test(p)

function NuevoUsuario({ onClose, onSave }) {
  const [nombre, setNombre] = useState('')
  const [pin, setPin] = useState('')
  const [rol, setRol] = useState('usuario')
  const ok = nombre.trim().length >= 2 && pinValido(pin)
  return (
    <Sheet title="Agregar usuario" onClose={onClose}>
      <label className="field">Nombre<input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" /></label>
      <label className="field">PIN (4 a 6 dígitos)<input className="input pin-input" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></label>
      <div className="field"><span>Rol</span>
        <Segmented options={[{ value: 'usuario', label: 'Usuario' }, { value: 'admin', label: 'Admin' }]} value={rol} onChange={setRol} label="Rol" />
      </div>
      <button className="btn btn-primary btn-block btn-lg" disabled={!ok} onClick={() => onSave({ nombre: nombre.trim(), pin, rol })}>Guardar usuario</button>
    </Sheet>
  )
}

function UsuarioSheet({ u, yo, onClose, onAccion }) {
  const [pin, setPin] = useState('')
  const soyYo = u.id === yo.id
  return (
    <Sheet title={u.nombre} onClose={onClose}>
      <div className="actions">
        <span className={`tag ${u.estado}`}>{u.estado}</span>
        <span className="tag">{u.rol}</span>
        {u.telegram_id && <span className="tag">Telegram {u.telegram_id}</span>}
      </div>
      {u.estado === 'pendiente' && (
        <button className="btn btn-primary btn-block btn-lg" onClick={() => onAccion({ accion: 'aprobar', id: u.id }, `${u.nombre} aprobado`)}>
          <Icon name="check" size={20} /> Aprobar
        </button>
      )}
      {u.estado === 'inactivo' && (
        <button className="btn btn-dark btn-block" onClick={() => onAccion({ accion: 'activar', id: u.id }, `${u.nombre} activado`)}>Activar</button>
      )}
      {!soyYo && (
        <button className="btn btn-soft btn-block" onClick={() => onAccion({ accion: 'cambiar_rol', id: u.id, rol: u.rol === 'admin' ? 'usuario' : 'admin' }, 'Rol actualizado')}>
          Cambiar a {u.rol === 'admin' ? 'usuario' : 'admin'}
        </button>
      )}
      <div className="grid-2" style={{ alignItems: 'end' }}>
        <label className="field">Nuevo PIN<input className="input pin-input" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></label>
        <button className="btn btn-dark" disabled={!pinValido(pin)} onClick={() => onAccion({ accion: 'cambiar_pin', id: u.id, pin }, 'PIN actualizado')}>Cambiar PIN</button>
      </div>
      {u.estado !== 'inactivo' && !soyYo && (
        <button className="btn btn-danger btn-block" onClick={() => onAccion({ accion: 'desactivar', id: u.id }, `${u.nombre} desactivado`)}>Desactivar</button>
      )}
    </Sheet>
  )
}

// ---------------- Productos ----------------
export function Productos({ back, notify, productos, onSaved }) {
  const [lista, setLista] = useState(() => productos.map((p) => ({ ...p, precioTxt: montoInput(p.precio) })))
  const [guardando, setGuardando] = useState(false)
  const cambiar = (id, patch) => setLista((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const sucio = lista.some((p, i) => p.activo !== productos[i]?.activo || parseMonto(p.precioTxt) !== productos[i]?.precio)

  async function guardar() {
    const nuevos = lista.map(({ precioTxt, ...p }) => ({ ...p, precio: parseMonto(precioTxt) }))
    if (nuevos.some((p) => !(p.precio > 0))) return notify('Hay un precio vacío o en cero.', true)
    setGuardando(true)
    try {
      await api.guardarProductos({ productos: nuevos })
      vibrar('success')
      notify('Productos guardados')
      onSaved(nuevos)
      back()
    } catch (e) {
      notify(e.message, true)
    } finally {
      setGuardando(false)
    }
  }

  const grupos = [...new Set(lista.map((p) => p.categoria))]
  return (
    <div className="screen">
      <TopBar title="Productos" onBack={back} />
      <main className="screen-body">
        <p className="hint">También puedes editarlos en la pestaña Productos del Google Sheets; la app los lee de ahí.</p>
        {grupos.map((g) => (
          <div className="prod-box" key={g}>
            <div className="prod-group">{g}</div>
            {lista.filter((p) => p.categoria === g).map((p) => (
              <div className="prod-row" key={p.id}>
                <div className="name">
                  <strong>{p.nombre}</strong>
                  <span>{p.presentacion}{p.activo ? '' : ' · oculto'}</span>
                </div>
                <label className="sr-only" htmlFor={`precio-${p.id}`}>Precio de {p.nombre} {p.presentacion}</label>
                <input id={`precio-${p.id}`} className="input price-input" inputMode="decimal" value={p.precioTxt}
                  onChange={(e) => cambiar(p.id, { precioTxt: e.target.value })} />
                <button className="switch" role="switch" aria-checked={p.activo} aria-label={`${p.nombre} ${p.presentacion} activo`}
                  onClick={() => cambiar(p.id, { activo: !p.activo })} />
              </div>
            ))}
          </div>
        ))}
      </main>
      <div className="bottom-bar">
        <button className="btn btn-primary btn-block btn-lg" disabled={!sucio || guardando} onClick={guardar}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}

// ---------------- Tasa ----------------
export function Tasa({ back, notify }) {
  const [t, setT] = useState(null)
  const [cargando, setCargando] = useState(false)
  useEffect(() => { api.tasa().then(setT).catch((e) => notify(e.message, true)) }, [notify])

  async function actualizar() {
    setCargando(true)
    try {
      const r = await api.actualizarTasa()
      setT(r)
      notify(r.sin_cambios ? 'La tasa no ha cambiado' : 'Tasa actualizada')
    } catch (e) {
      notify(e.message, true)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="screen">
      <TopBar title="Tasa del día" onBack={back} />
      <main className="screen-body">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Tasa oficial BCV</span>
          <span className="big-rate">{t ? formatBs(t.tasa) : '…'}</span>
          {t && <span>Fecha valor: {fechaCorta(t.fecha_valor)} · fuente: {t.fuente}</span>}
          {t?.consultada && <span className="hint">Consultada: {new Date(t.consultada).toLocaleString('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' })}</span>}
          {t && <span className="hint">$1 = {formatBs(t.tasa)} · Bs. 1.000 = {formatUsd(1000 / t.tasa)}</span>}
        </section>
        <p className="hint">n8n la consulta sola dos veces al día. Si el BCV publica una tasa nueva en la tarde, rige desde su fecha valor (normalmente el siguiente día hábil).</p>
        <button className="btn btn-dark btn-block btn-lg" disabled={cargando} onClick={actualizar}>
          {cargando ? <><Spinner /> Consultando…</> : <><Icon name="rate" size={20} /> Actualizar ahora</>}
        </button>
      </main>
    </div>
  )
}
