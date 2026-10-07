// ===== Lógica de la API de Bombi Control =====
// Función pura: recibe la petición + las hojas leídas y devuelve qué responder y qué escribir.
// En n8n va dentro del nodo Code "Lógica Bombi" (ver envoltorio.js). Aquí se prueba con node --test.

const METODOS = ['Pago Móvil', 'Transferencia', 'Punto de venta', 'Efectivo Bs', 'Efectivo USD', 'Zelle', 'Binance'];
const CATEGORIAS = ['Ingredientes', 'Empaques', 'Delivery', 'Servicios', 'Equipos', 'Publicidad', 'Otros'];
const DIA_MS = 864e5;
const SESION_DIAS = 30;

class Fallo extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const txt = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const sinAcentos = (s) => txt(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const esSi = (v) => ['si', 'sí', 'true', '1', 'x'].includes(sinAcentos(v));
// Evita que un texto escrito por el usuario se interprete como fórmula en la hoja.
const seguro = (s) => { const t = txt(s); return /^[=+\-@]/.test(t) ? "'" + t : t; };
const comoTexto = (s) => (txt(s) ? "'" + txt(s) : '');

// ---------- Fechas (Venezuela UTC-4, sin horario de verano) ----------
function caracas(ahora) {
  const d = new Date(ahora.getTime() - 4 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return {
    fecha: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    hora: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
    compacto: `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`,
  };
}
const isoAFecha = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fechaAIso = (d) => d.toISOString().slice(0, 10);
const sumarDias = (iso, n) => fechaAIso(new Date(isoAFecha(iso).getTime() + n * DIA_MS));
function fechaCelda(v) {
  if (typeof v === 'number' && v > 20000) return fechaAIso(new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * DIA_MS));
  const s = txt(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
function horaCelda(v) {
  if (typeof v === 'number') { const min = Math.round((v % 1) * 1440); return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
  const m = txt(v).match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
}
function rango(periodo, hoy) {
  if (periodo === 'semana') { const wd = (isoAFecha(hoy).getUTCDay() + 6) % 7; const d = sumarDias(hoy, -wd); return [d, sumarDias(d, 6)]; }
  if (periodo === 'mes') { const d = isoAFecha(hoy.slice(0, 8) + '01'); const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)); return [fechaAIso(d), fechaAIso(fin)]; }
  return [hoy, hoy];
}
function viernesSiguiente(iso) { const wd = isoAFecha(iso).getUTCDay(); return sumarDias(iso, ((5 - wd + 7) % 7) || 7); }

// ---------- Hojas ----------
function letra(i) { let s = ''; i += 1; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
function tabla(nombre, valores) {
  const enc = (valores?.[0] || []).map((h) => txt(h));
  const filas = [];
  (valores || []).slice(1).forEach((v, i) => {
    if (!v || !v.some((c) => txt(c) !== '')) return;
    const o = { _fila: i + 2 };
    enc.forEach((h, j) => { if (h) o[h] = v[j] ?? ''; });
    filas.push(o);
  });
  return { nombre, enc, filas };
}
function leerHojas(lectura) {
  const hojas = {};
  for (const vr of lectura?.valueRanges || []) {
    const nombre = vr.range.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
    hojas[nombre] = tabla(nombre, vr.values);
  }
  for (const n of ['Usuarios', 'Ventas', 'Gastos', 'Por cobrar', 'Productos', 'Tasas']) if (!hojas[n]) throw new Fallo(503, `No pude leer la pestaña "${n}" del Sheet.`);
  return hojas;
}
// Arma una fila en el orden exacto de los encabezados de la hoja.
function filaPara(t, datos) {
  for (const k of Object.keys(datos)) if (!t.enc.includes(k)) throw new Fallo(500, `Falta la columna "${k}" en la pestaña ${t.nombre}.`);
  let ultima = 0; t.enc.forEach((h, j) => { if (h in datos) ultima = j; });
  return t.enc.slice(0, ultima + 1).map((h) => (h in datos ? datos[h] : null));
}
function celda(t, fila, col) {
  const j = t.enc.indexOf(col); if (j < 0) throw new Fallo(500, `Falta la columna "${col}" en la pestaña ${t.nombre}.`);
  return `'${t.nombre.replace(/'/g, "''")}'!${letra(j)}${fila}`;
}

// ---------- Tasa ----------
function ultimaTasa(h) {
  const t = h.Tasas.filas.filter((f) => num(f.Tasa) > 0);
  if (t.length) {
    const f = t[t.length - 1];
    return { tasa: num(f.Tasa), fecha_valor: fechaCelda(f['Fecha valor']), fuente: txt(f.Fuente), consultada: txt(f.Consultada) };
  }
  // Mientras la pestaña Tasas esté vacía, usa la última tasa registrada en Ventas.
  const v = h.Ventas.filas.filter((f) => num(f['Tasa BCV']) > 0).sort((a, b) => b._fila - a._fila)[0];
  return v ? { tasa: num(v['Tasa BCV']), fecha_valor: fechaCelda(v.Fecha), fuente: 'última venta', consultada: '' } : null;
}

// ---------- Sesión ----------
function firmar(cfg, u, ahora) {
  const exp = Math.floor(ahora.getTime() / 1000) + SESION_DIAS * 86400;
  const cuerpo = b64url(utf8Bytes(JSON.stringify({ u: txt(u.id), e: exp })));
  return { token: cuerpo + '.' + b64url(hmac(utf8Bytes(cfg.token_secret), utf8Bytes(cuerpo))), expira: new Date(exp * 1000).toISOString() };
}
function verificar(cfg, headers, ahora) {
  const m = txt(headers?.authorization || headers?.Authorization).match(/^Bearer\s+(\S+)$/);
  if (!m) throw new Fallo(401, 'Inicia sesión de nuevo.');
  const [cuerpo, firma] = m[1].split('.');
  if (!cuerpo || !firma || !iguales(firma, b64url(hmac(utf8Bytes(cfg.token_secret), utf8Bytes(cuerpo))))) throw new Fallo(401, 'Tu sesión no es válida. Entra de nuevo.');
  const p = JSON.parse(utf8Texto(b64urlDecode(cuerpo)));
  if (!(p.e * 1000 > ahora.getTime())) throw new Fallo(401, 'Tu sesión expiró. Entra de nuevo.');
  return p.u;
}
const publico = (f) => ({ id: txt(f.id), nombre: txt(f.nombre), rol: txt(f.rol) || 'usuario', estado: txt(f.estado) });
const hashPin = (sal, pin) => hex(sha256(utf8Bytes(`${sal}:${pin}`)));

function validarInitData(initData, botToken, ahora) {
  const params = {};
  for (const par of String(initData).split('&')) {
    const i = par.indexOf('='); if (i < 0) continue;
    params[decodeURIComponent(par.slice(0, i))] = decodeURIComponent(par.slice(i + 1).replace(/\+/g, ' '));
  }
  const hash = params.hash; delete params.hash;
  const dcs = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('\n');
  const clave = hmac(utf8Bytes('WebAppData'), utf8Bytes(botToken));
  if (!hash || !iguales(hex(hmac(clave, utf8Bytes(dcs))), hash)) throw new Fallo(401, 'No pude verificar tu sesión de Telegram.');
  if (ahora.getTime() / 1000 - Number(params.auth_date) > 86400) throw new Fallo(401, 'La sesión de Telegram expiró. Cierra y abre la app.');
  return JSON.parse(params.user || '{}');
}

// ---------- Rutas ----------
function auth(ctx, h, res) {
  const { body, cfg, ahora } = ctx;
  const U = h.Usuarios;
  if (body.initData) {
    if (!txt(cfg.telegram_bot_token)) throw new Fallo(503, 'La entrada por Telegram aún no está configurada. Entra con nombre y PIN.');
    const tg = validarInitData(body.initData, txt(cfg.telegram_bot_token), ahora);
    const u = U.filas.find((f) => txt(f.telegram_id) === String(tg.id));
    if (u) {
      if (txt(u.estado) !== 'activo') return res(200, { estado: txt(u.estado) || 'pendiente' });
      return res(200, { estado: 'activo', usuario: publico(u), ...firmar(cfg, u, ahora) });
    }
    const nombre = [tg.first_name, tg.last_name].filter(Boolean).join(' ').trim() || `Telegram ${tg.id}`;
    res.escrituras.push({ tipo: 'append', hoja: 'Usuarios', fila: filaPara(U, {
      id: `u${ahora.getTime()}`, nombre: seguro(nombre), telegram_id: String(tg.id), rol: 'usuario', estado: 'pendiente',
      fecha_creacion: caracas(ahora).fecha, intentos_fallidos: 0,
    }) });
    for (const a of U.filas.filter((f) => txt(f.rol) === 'admin' && txt(f.estado) === 'activo' && txt(f.telegram_id))) {
      res.avisos.push({ chat_id: txt(a.telegram_id), texto: `${nombre} pidió acceso a Bombi Control. Apruébalo en la app: Ajustes → Usuarios.` });
    }
    return res(200, { estado: 'pendiente' });
  }
  const nombre = sinAcentos(body.nombre); const pin = txt(body.pin);
  if (!nombre || !/^\d{4,6}$/.test(pin)) throw new Fallo(400, 'Escribe tu nombre y un PIN de 4 a 6 dígitos.');
  const u = U.filas.find((f) => sinAcentos(f.nombre) === nombre);
  if (!u) throw new Fallo(401, 'Nombre o PIN incorrecto.');
  const bloqueo = Date.parse(txt(u.bloqueado_hasta));
  if (bloqueo > ahora.getTime()) throw new Fallo(429, `Demasiados intentos. Espera ${Math.ceil((bloqueo - ahora.getTime()) / 60000)} min.`);
  if (!txt(u.pin_hash)) throw new Fallo(403, 'Todavía no tienes PIN. Pídele a un admin que te asigne uno.');
  if (!iguales(hashPin(txt(u.pin_sal), pin), txt(u.pin_hash))) {
    const intentos = num(u.intentos_fallidos) + 1;
    const bloquear = intentos >= 5;
    res.escrituras.push({ tipo: 'update', rango: celda(U, u._fila, 'intentos_fallidos'), valor: bloquear ? 0 : intentos });
    if (bloquear) res.escrituras.push({ tipo: 'update', rango: celda(U, u._fila, 'bloqueado_hasta'), valor: comoTexto(new Date(ahora.getTime() + 10 * 60000).toISOString()) });
    return res(401, { ok: false, error: bloquear ? 'Demasiados intentos. Espera 10 min.' : 'Nombre o PIN incorrecto.' });
  }
  if (txt(u.estado) !== 'activo') return res(403, { ok: false, error: txt(u.estado) === 'pendiente' ? 'Tu usuario está pendiente de aprobación.' : 'Tu usuario está desactivado.' });
  if (num(u.intentos_fallidos) || txt(u.bloqueado_hasta)) {
    res.escrituras.push({ tipo: 'update', rango: celda(U, u._fila, 'intentos_fallidos'), valor: 0 });
    res.escrituras.push({ tipo: 'update', rango: celda(U, u._fila, 'bloqueado_hasta'), valor: '' });
  }
  return res(200, { estado: 'activo', usuario: publico(u), ...firmar(cfg, u, ahora) });
}

function venta(f) {
  return { id: txt(f.ID), fecha: fechaCelda(f.Fecha), hora: horaCelda(f.Hora), fila: f._fila, anulado: esSi(f.Anulado),
    monto: num(f.Monto), moneda: txt(f.Moneda) || 'Bs', monto_usd: r2(f['Monto USD']), referencia: txt(f.Referencia).replace(/^'/, ''),
    cliente: txt(f.Cliente), producto: txt(f.Producto), metodo: txt(f['Método']), quien: txt(f['Registrado por']),
    origen: txt(f.Origen), orden: txt(f.Orden), request_id: txt(f['Request id']) };
}
function gasto(f) {
  return { id: txt(f.ID), fecha: fechaCelda(f.Fecha), hora: horaCelda(f.Hora), fila: f._fila, anulado: esSi(f.Anulado),
    monto: num(f.Monto), moneda: txt(f.Moneda) || 'Bs', monto_usd: r2(f['Monto USD']), referencia: txt(f.Referencia).replace(/^'/, ''),
    concepto: txt(f.Concepto), categoria: txt(f['Categoría']), quien: txt(f['Registrado por']), origen: txt(f.Origen),
    request_id: txt(f['Request id']) };
}
function orden(f, tasa) {
  const moneda = txt(f.Moneda) || 'USD';
  const monto = num(f.Monto);
  return { orden: num(f.Orden), fila: f._fila, fecha_entrega: fechaCelda(f['Fecha entrega']), cliente: txt(f.Cliente),
    productos: txt(f.Productos), monto, moneda, fecha_esperada_pago: fechaCelda(f['Fecha esperada pago']),
    estado: sinAcentos(f.Estado) || 'pendiente', monto_usd: moneda === 'Bs' ? (tasa > 0 ? r2(monto / tasa) : 0) : r2(monto) };
}

function resumen(ctx, h, res) {
  const hoy = caracas(ctx.ahora).fecha;
  const [desde, hasta] = rango(ctx.body.periodo, hoy);
  const tasa = ultimaTasa(h);
  const V = h.Ventas.filas.map(venta), G = h.Gastos.filas.map(gasto);
  const O = h['Por cobrar'].filas.map((f) => orden(f, tasa?.tasa || 0));
  const enRango = (x) => !x.anulado && x.fecha >= desde && x.fecha <= hasta;
  const ventas = r2(V.filter(enRango).reduce((s, x) => s + x.monto_usd, 0));
  const gastos = r2(G.filter(enRango).reduce((s, x) => s + x.monto_usd, 0));
  const pend = O.filter((o) => o.estado === 'pendiente');
  const bot = (x) => (x.origen === 'webapp' ? x.quien : `${x.quien} (bot)`);
  const movs = [
    ...V.map((v) => ({ id: v.id, tipo: 'venta', fecha: v.fecha, k: `${v.fecha} ${v.hora} ${String(v.fila).padStart(6, '0')}`, anulado: v.anulado,
      titulo: v.orden ? `Venta · Orden #${v.orden}` : `Venta · ${v.metodo || 'sin método'}`, detalle: [v.cliente || v.producto, bot(v)].filter(Boolean).join(' · '), monto_usd: v.monto_usd })),
    ...G.map((g) => ({ id: g.id, tipo: 'gasto', fecha: g.fecha, k: `${g.fecha} ${g.hora} ${String(g.fila).padStart(6, '0')}`, anulado: g.anulado,
      titulo: `Gasto · ${g.categoria || 'Otros'}`, detalle: [g.concepto, bot(g)].filter(Boolean).join(' · '), monto_usd: g.monto_usd })),
    ...O.map((o) => ({ id: `o${o.orden}`, tipo: 'cobrar', fecha: o.fecha_entrega, k: `${o.fecha_entrega} 00:00 ${String(o.fila).padStart(6, '0')}`, anulado: o.estado === 'anulada',
      titulo: `Orden #${o.orden} · ${o.cliente}`, detalle: o.estado === 'pagado' ? 'Cobrada' : 'Pendiente de cobro', monto_usd: o.monto_usd })),
  ].sort((a, b) => b.k.localeCompare(a.k)).slice(0, 5).map(({ k, ...m }) => m);
  return res(200, { desde, hasta, ventas_usd: ventas, gastos_usd: gastos, ganancia_usd: r2(ventas - gastos),
    por_cobrar: { cantidad: pend.length, total_usd: r2(pend.reduce((s, o) => s + o.monto_usd, 0)) }, ultimos: movs, tasa });
}

function porCobrar(ctx, h, res) {
  const tasa = ultimaTasa(h)?.tasa || 0;
  const todas = h['Por cobrar'].filas.map((f) => orden(f, tasa));
  const ordenes = todas.filter((o) => o.estado === 'pendiente').sort((a, b) => a.orden - b.orden);
  return res(200, { ordenes: ordenes.map(({ fila, ...o }) => o), total_usd: r2(ordenes.reduce((s, o) => s + o.monto_usd, 0)),
    hay_bs: ordenes.some((o) => o.moneda === 'Bs'), proximo_numero: Math.max(0, ...todas.map((o) => o.orden)) + 1 });
}

function buscarReferencia(h, ref) {
  const r = txt(ref).replace(/^'/, ''); if (!r) return null;
  const v = h.Ventas.filas.map(venta).find((x) => !x.anulado && x.referencia === r);
  if (v) return { tipo: 'venta', fecha: v.fecha, monto: v.monto, moneda: v.moneda, cliente: v.cliente || v.producto };
  const g = h.Gastos.filas.map(gasto).find((x) => !x.anulado && x.referencia === r);
  return g ? { tipo: 'gasto', fecha: g.fecha, monto: g.monto, moneda: g.moneda, cliente: g.concepto } : null;
}
function yaProcesado(h, rid) {
  return !!txt(rid) && [...h.Ventas.filas, ...h.Gastos.filas].some((f) => txt(f['Request id']) === txt(rid));
}
function nuevoId(t, pref, ahora) {
  const base = `${pref}-${caracas(ahora).compacto}`;
  const usados = new Set(t.filas.map((f) => txt(f.ID)));
  let id = base, n = 2; while (usados.has(id)) id = `${base}-${n++}`;
  return id;
}
function montos(b, tasaDia) {
  const monto = r2(b.monto); const moneda = b.moneda === 'USD' ? 'USD' : 'Bs';
  const tasa = num(b.tasa) > 0 ? num(b.tasa) : tasaDia;
  if (!(monto > 0)) throw new Fallo(400, 'El monto debe ser mayor que cero.');
  if (!(tasa > 0)) throw new Fallo(400, 'Falta la tasa del día.');
  return { monto, moneda, tasa, usd: moneda === 'USD' ? monto : r2(monto / tasa), bs: moneda === 'Bs' ? monto : r2(monto * tasa) };
}
function fechaValida(f, hoy) { const s = fechaCelda(f); return s || hoy; }

function registro(ctx, h, res, u) {
  const b = ctx.body; const ahora = ctx.ahora; const c = caracas(ahora);
  if (b.tipo === 'cobrar') {
    const P = h['Por cobrar'];
    const monto = r2(b.monto);
    if (!(monto > 0)) throw new Fallo(400, 'El monto debe ser mayor que cero.');
    if (!txt(b.cliente)) throw new Fallo(400, 'Escribe la empresa.');
    const n = Math.max(0, ...P.filas.map((f) => num(f.Orden))) + 1;
    const entrega = fechaValida(b.fecha_entrega, c.fecha);
    res.escrituras.push({ tipo: 'append', hoja: 'Por cobrar', fila: filaPara(P, {
      Orden: n, 'Fecha entrega': entrega, Cliente: seguro(b.cliente), Productos: seguro(b.productos), Monto: monto, Moneda: 'USD',
      'Fecha esperada pago': fechaCelda(b.fecha_esperada_pago) || viernesSiguiente(entrega), Estado: 'pendiente',
      'Registrado por': u.nombre, Origen: 'webapp' }) });
    return res(200, { ok: true, orden: n });
  }
  if (b.tipo !== 'venta' && b.tipo !== 'gasto') throw new Fallo(400, 'Tipo de registro desconocido.');
  if (yaProcesado(h, b.request_id)) return res(200, { ok: true, repetido: true });
  if (!METODOS.includes(b.metodo)) throw new Fallo(400, 'Método de pago no válido.');
  const dup = buscarReferencia(h, b.referencia);
  if (dup && !b.confirmar_duplicado) return res(409, { ok: false, error: 'Esa referencia ya está registrada.', duplicado: dup });
  const m = montos(b, ultimaTasa(h)?.tasa || 0);
  const comun = { Fecha: fechaValida(b.fecha, c.fecha), Hora: c.hora, Monto: m.monto, Moneda: m.moneda, 'Tasa BCV': m.tasa,
    'Monto USD': m.usd, 'Monto Bs': m.bs, 'Método': b.metodo, Referencia: comoTexto(b.referencia), 'Registrado por': u.nombre,
    Origen: 'webapp', 'Request id': txt(b.request_id) };
  if (ctx.linkCapture) comun['Link capture'] = ctx.linkCapture;
  if (b.tipo === 'venta') {
    const id = nuevoId(h.Ventas, 'V', ahora);
    res.escrituras.push({ tipo: 'append', hoja: 'Ventas', fila: filaPara(h.Ventas, { ID: id, ...comun,
      Producto: seguro(b.productos), Cantidad: num(b.cantidad) || '', Banco: seguro(b.banco), Cliente: seguro(b.cliente) }) });
    return res(200, { ok: true, id });
  }
  if (!CATEGORIAS.includes(b.categoria)) throw new Fallo(400, 'Categoría no válida.');
  const id = nuevoId(h.Gastos, 'G', ahora);
  res.escrituras.push({ tipo: 'append', hoja: 'Gastos', fila: filaPara(h.Gastos, { ID: id, ...comun,
    Concepto: seguro(b.concepto), 'Categoría': b.categoria, Proveedor: seguro(b.proveedor) }) });
  return res(200, { ok: true, id });
}

function cobrar(ctx, h, res, u) {
  const b = ctx.body; const c = caracas(ctx.ahora); const P = h['Por cobrar'];
  if (yaProcesado(h, b.request_id)) return res(200, { ok: true, repetido: true });
  const f = P.filas.find((x) => num(x.Orden) === num(b.orden));
  if (!f || sinAcentos(f.Estado) !== 'pendiente') throw new Fallo(404, `La orden #${b.orden} no está pendiente.`);
  if (!METODOS.includes(b.metodo)) throw new Fallo(400, 'Método de pago no válido.');
  const dup = buscarReferencia(h, b.referencia);
  if (dup && !b.confirmar_duplicado) return res(409, { ok: false, error: 'Esa referencia ya está registrada.', duplicado: dup });
  const m = montos(b, ultimaTasa(h)?.tasa || 0);
  const fecha = fechaValida(b.fecha, c.fecha);
  const id = nuevoId(h.Ventas, 'V', ctx.ahora);
  const venta = { ID: id, Fecha: fecha, Hora: c.hora, Producto: seguro(f.Productos), Monto: m.monto, Moneda: m.moneda,
    'Tasa BCV': m.tasa, 'Monto USD': m.usd, 'Monto Bs': m.bs, 'Método': b.metodo, Banco: seguro(b.banco),
    Referencia: comoTexto(b.referencia), Cliente: seguro(f.Cliente), 'Registrado por': u.nombre, Orden: num(f.Orden),
    Origen: 'webapp', 'Request id': txt(b.request_id) };
  if (ctx.linkCapture) venta['Link capture'] = ctx.linkCapture;
  res.escrituras.push({ tipo: 'append', hoja: 'Ventas', fila: filaPara(h.Ventas, venta) });
  const cambios = { Estado: 'pagado', 'Fecha pago': fecha, 'Metodo de pago': b.metodo, Referencia: comoTexto(b.referencia),
    'Moneda pago': m.moneda, 'Monto pagado': m.monto, 'Tasa pago': m.tasa, 'Monto pagado USD': m.usd };
  if (ctx.linkCapture) cambios['Link capture'] = ctx.linkCapture;
  for (const [col, valor] of Object.entries(cambios)) res.escrituras.push({ tipo: 'update', rango: celda(P, f._fila, col), valor });
  return res(200, { ok: true, id });
}

function anular(ctx, h, res) {
  const { tipo, id } = ctx.body;
  if (tipo === 'cobrar') {
    const P = h['Por cobrar']; const f = P.filas.find((x) => `o${num(x.Orden)}` === txt(id));
    if (!f || sinAcentos(f.Estado) !== 'pendiente') throw new Fallo(400, 'Solo se pueden anular órdenes pendientes.');
    res.escrituras.push({ tipo: 'update', rango: celda(P, f._fila, 'Estado'), valor: 'anulada' });
    return res(200, { ok: true });
  }
  const t = tipo === 'venta' ? h.Ventas : tipo === 'gasto' ? h.Gastos : null;
  const f = t?.filas.find((x) => txt(x.ID) === txt(id));
  if (!f) throw new Fallo(404, 'Registro no encontrado.');
  res.escrituras.push({ tipo: 'update', rango: celda(t, f._fila, 'Anulado'), valor: 'sí' });
  return res(200, { ok: true });
}

const producto = (f) => ({ id: txt(f.id), nombre: txt(f.Nombre), categoria: txt(f['Categoría']), presentacion: txt(f['Presentación']), precio: r2(f['Precio USD']), activo: esSi(f.Activo) });

function guardarProductos(ctx, h, res) {
  const P = h.Productos;
  for (const p of ctx.body.productos || []) {
    const f = P.filas.find((x) => txt(x.id) === txt(p.id)); if (!f) continue;
    const precio = r2(p.precio); if (!(precio > 0)) throw new Fallo(400, `Precio inválido para ${txt(f.Nombre)}.`);
    if (precio !== r2(f['Precio USD'])) res.escrituras.push({ tipo: 'update', rango: celda(P, f._fila, 'Precio USD'), valor: precio });
    if (!!p.activo !== esSi(f.Activo)) res.escrituras.push({ tipo: 'update', rango: celda(P, f._fila, 'Activo'), valor: p.activo ? 'sí' : 'no' });
  }
  return res(200, { ok: true });
}

function usuarioAccion(ctx, h, res, yo) {
  const b = ctx.body; const U = h.Usuarios;
  const pinOk = (p) => /^\d{4,6}$/.test(txt(p));
  if (b.accion === 'crear') {
    if (txt(b.nombre).length < 2) throw new Fallo(400, 'Escribe el nombre.');
    if (U.filas.some((f) => sinAcentos(f.nombre) === sinAcentos(b.nombre))) throw new Fallo(409, 'Ya existe un usuario con ese nombre.');
    if (!pinOk(b.pin)) throw new Fallo(400, 'El PIN debe tener de 4 a 6 dígitos.');
    const sal = aleatorioHex(16);
    res.escrituras.push({ tipo: 'append', hoja: 'Usuarios', fila: filaPara(U, {
      id: `u${ctx.ahora.getTime()}`, nombre: seguro(b.nombre), telegram_id: '', pin_hash: hashPin(sal, txt(b.pin)), pin_sal: sal,
      rol: b.rol === 'admin' ? 'admin' : 'usuario', estado: 'activo', fecha_creacion: caracas(ctx.ahora).fecha, intentos_fallidos: 0, bloqueado_hasta: '' }) });
    return res(200, { ok: true });
  }
  const f = U.filas.find((x) => txt(x.id) === txt(b.id));
  if (!f) throw new Fallo(404, 'Usuario no encontrado.');
  const set = (col, valor) => res.escrituras.push({ tipo: 'update', rango: celda(U, f._fila, col), valor });
  const admins = U.filas.filter((x) => txt(x.rol) === 'admin' && txt(x.estado) === 'activo');
  const ultimoAdmin = txt(f.rol) === 'admin' && admins.length <= 1;
  if (b.accion === 'aprobar' || b.accion === 'activar') set('estado', 'activo');
  else if (b.accion === 'desactivar') {
    if (txt(f.id) === yo.id) throw new Fallo(400, 'No puedes desactivarte a ti mismo.');
    if (ultimoAdmin) throw new Fallo(400, 'Debe quedar al menos un admin activo.');
    set('estado', 'inactivo');
  } else if (b.accion === 'cambiar_rol') {
    if (b.rol !== 'admin' && ultimoAdmin) throw new Fallo(400, 'Debe quedar al menos un admin activo.');
    set('rol', b.rol === 'admin' ? 'admin' : 'usuario');
  } else if (b.accion === 'cambiar_pin') {
    if (!pinOk(b.pin)) throw new Fallo(400, 'El PIN debe tener de 4 a 6 dígitos.');
    const sal = aleatorioHex(16);
    set('pin_hash', hashPin(sal, txt(b.pin))); set('pin_sal', sal); set('intentos_fallidos', 0); set('bloqueado_hasta', '');
  } else throw new Fallo(400, 'Acción desconocida.');
  return res(200, { ok: true });
}

// ---------- Entrada ----------
const SOLO_ADMIN = ['anular', 'productos-guardar', 'usuarios', 'usuarios-accion', 'tasa-actualizar'];

function procesar(ctx) {
  const out = { paso: 'responder', status: 200, respuesta: null, escrituras: [], avisos: [] };
  const res = (status, respuesta) => { out.status = status; out.respuesta = respuesta; return out; };
  res.escrituras = out.escrituras; res.avisos = out.avisos;
  try {
    if (!txt(ctx.cfg?.token_secret) || txt(ctx.cfg.token_secret).length < 32) throw new Fallo(503, 'Falta configurar token_secret en la tabla bombi_config.');
    if (ctx.errorLectura) throw new Fallo(503, 'No pude leer el Google Sheet. Intenta de nuevo en un momento.');
    const h = leerHojas(ctx.lectura);
    const ruta = txt(ctx.ruta);
    if (ruta === 'auth') return auth(ctx, h, res);
    const uid = verificar(ctx.cfg, ctx.headers, ctx.ahora);
    const fu = h.Usuarios.filas.find((f) => txt(f.id) === uid);
    if (!fu || txt(fu.estado) !== 'activo') throw new Fallo(401, 'Tu usuario ya no está activo.');
    const u = publico(fu);
    if (SOLO_ADMIN.includes(ruta) && u.rol !== 'admin') throw new Fallo(403, 'Solo un admin puede hacer esto.');
    switch (ruta) {
      case 'resumen': return resumen(ctx, h, res);
      case 'tasa': { const t = ultimaTasa(h); if (!t) throw new Fallo(404, 'Todavía no hay tasa guardada.'); return res(200, t); }
      case 'tasa-actualizar': out.paso = 'tasa'; return res(200, null);
      case 'leer-capture': if (!ctx.tieneCapture) throw new Fallo(400, 'No llegó ninguna imagen.'); out.paso = 'capture'; return res(200, null);
      case 'registro': return registro(ctx, h, res, u);
      case 'por-cobrar': return porCobrar(ctx, h, res);
      case 'cobrar': return cobrar(ctx, h, res, u);
      case 'anular': return anular(ctx, h, res);
      case 'productos': return res(200, { productos: h.Productos.filas.map(producto) });
      case 'productos-guardar': return guardarProductos(ctx, h, res);
      case 'usuarios': return res(200, { usuarios: h.Usuarios.filas.map((f) => ({ ...publico(f), telegram_id: txt(f.telegram_id), fecha_creacion: fechaCelda(f.fecha_creacion) })) });
      case 'usuarios-accion': return usuarioAccion(ctx, h, res, u);
      default: throw new Fallo(404, 'Ruta desconocida.');
    }
  } catch (e) {
    out.escrituras.length = 0; out.avisos.length = 0; out.paso = 'responder';
    if (e instanceof Fallo) return res(e.status, { ok: false, error: e.message, ...(e.extra || {}) });
    return res(500, { ok: false, error: `Error interno: ${e.message}` });
  } finally {
    if (out.escrituras.length && out.paso === 'responder') out.paso = 'escribir';
  }
}
