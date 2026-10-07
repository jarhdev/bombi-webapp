/**
 * Bombi Control · Preparar el Google Sheet para la webapp
 *
 * Se pega en el Sheet "Bombi_Control_Ventas": Extensiones → Apps Script.
 * Pasos completos en docs/GUIA.md, sección "Preparar el Google Sheet".
 *
 * - No borra ni mueve nada: solo agrega columnas al final y pestañas nuevas.
 * - Se puede correr varias veces: lo que ya existe se deja igual.
 */

// Columnas que la webapp necesita al final de las hojas que ya usa el bot.
const COLUMNAS_NUEVAS = {
  'Ventas': ['Orden', 'Origen', 'Link capture', 'Anulado', 'Request id'],
  'Gastos': ['Origen', 'Link capture', 'Anulado', 'Request id'],
  'Por cobrar': ['Registrado por', 'Origen', 'Moneda pago', 'Monto pagado', 'Tasa pago', 'Monto pagado USD', 'Link capture'],
};

// Catálogo inicial (precios en USD). Después se edita desde la app o aquí mismo.
const SABORES_NY = ['NY Red Velvet', 'NY Milka', 'NY Nutella', 'NY Lemon', 'NY Cri Cri', 'NY Pirulin'];
function filasProductos_() {
  const filas = [];
  SABORES_NY.forEach((s) => {
    const id = s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    filas.push([`${id}-100`, s, 'NY Cookies', '100g', 2.5, 'sí']);
    filas.push([`${id}-160`, s, 'NY Cookies', '160g', 3.5, 'sí']);
  });
  filas.push(['thin-40', 'Thin Cookies', 'Otros', '40g', 2, 'sí']);
  filas.push(['banana-500', 'Banana Bread', 'Otros', '500g', 4.5, 'sí']);
  filas.push(['brownie-150', 'Brownie', 'Otros', '150g', 2.5, 'sí']);
  filas.push(['chocochips-5', 'Chocochips', 'Otros', 'Pack de 5', 2, 'sí']);
  return filas;
}

// Usuarios iniciales. El PIN se asigna después con el menú Bombi → "Asignar PIN".
// telegram_id: pégalo a mano en la hoja (los IDs están en el nodo Config del bot).
function filasUsuarios_() {
  const hoy = Utilities.formatDate(new Date(), 'America/Caracas', 'yyyy-MM-dd');
  return [
    ['u1', 'Jose', '', '', '', 'admin', 'activo', hoy, 0, ''],
    ['u2', 'Laura', '', '', '', 'admin', 'activo', hoy, 0, ''],
    ['u3', 'Victor', '', '', '', 'usuario', 'activo', hoy, 0, ''],
    ['u4', 'Paola', '', '', '', 'usuario', 'activo', hoy, 0, ''],
  ];
}

const PESTANAS_NUEVAS = {
  'Productos': { cols: ['id', 'Nombre', 'Categoría', 'Presentación', 'Precio USD', 'Activo'], filas: filasProductos_ },
  'Usuarios': { cols: ['id', 'nombre', 'telegram_id', 'pin_hash', 'pin_sal', 'rol', 'estado', 'fecha_creacion', 'intentos_fallidos', 'bloqueado_hasta'], filas: filasUsuarios_ },
  'Tasas': { cols: ['Fecha valor', 'Tasa', 'Fuente', 'Consultada'], filas: () => [] },
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Bombi')
    .addItem('1. Preparar hoja para la webapp', 'prepararSheet')
    .addItem('2. Asignar PIN a un usuario', 'asignarPin')
    .addItem('3. Copiar fórmulas (para revisión)', 'copiarFormulas')
    .addToUi();
}

function prepararSheet() {
  const ss = SpreadsheetApp.getActive();
  const informe = [];

  Object.keys(COLUMNAS_NUEVAS).forEach((nombre) => {
    const sh = ss.getSheetByName(nombre);
    if (!sh) { informe.push(`⚠ No encontré la pestaña "${nombre}".`); return; }
    const ultima = sh.getLastColumn();
    const encabezados = sh.getRange(1, 1, 1, ultima).getValues()[0].map((h) => String(h).trim());
    const faltan = COLUMNAS_NUEVAS[nombre].filter((c) => !encabezados.includes(c));
    if (!faltan.length) { informe.push(`${nombre}: ya tenía todas las columnas.`); return; }
    const necesarias = ultima + faltan.length - sh.getMaxColumns();
    if (necesarias > 0) sh.insertColumnsAfter(sh.getMaxColumns(), necesarias);
    sh.getRange(1, ultima + 1, 1, faltan.length).setValues([faltan]);
    // Mismo estilo que el último encabezado (fondo carmesí, negrita).
    sh.getRange(1, ultima).copyFormatToRange(sh, ultima + 1, ultima + faltan.length, 1, 1);
    informe.push(`${nombre}: agregué ${faltan.join(', ')}.`);
  });

  Object.keys(PESTANAS_NUEVAS).forEach((nombre) => {
    if (ss.getSheetByName(nombre)) { informe.push(`${nombre}: ya existía, no la toqué.`); return; }
    const def = PESTANAS_NUEVAS[nombre];
    const sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, def.cols.length).setValues([def.cols])
      .setFontWeight('bold').setBackground('#6f1425').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    const filas = def.filas();
    if (filas.length) sh.getRange(2, 1, filas.length, def.cols.length).setValues(filas);
    if (nombre === 'Usuarios') sh.getRange('C:E').setNumberFormat('@'); // IDs y hashes como texto
    sh.autoResizeColumns(1, def.cols.length);
    informe.push(`${nombre}: creada${filas.length ? ` con ${filas.length} filas` : ''}.`);
  });

  avisar_('Hoja preparada', informe.join('\n'));
}

// Guarda el PIN con hash: SHA-256 de (sal + ":" + pin), en hexadecimal. n8n valida igual.
function asignarPin() {
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('Asignar PIN', 'Nombre del usuario (como está en la pestaña Usuarios):', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const nombre = r1.getResponseText().trim().toLowerCase();
  const r2 = ui.prompt('Asignar PIN', 'PIN nuevo (4 a 6 dígitos):', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const pin = r2.getResponseText().trim();
  if (!/^\d{4,6}$/.test(pin)) { ui.alert('El PIN debe tener de 4 a 6 dígitos.'); return; }

  const sh = SpreadsheetApp.getActive().getSheetByName('Usuarios');
  if (!sh) { ui.alert('Primero corre "Preparar hoja para la webapp".'); return; }
  const datos = sh.getDataRange().getValues();
  const col = datos[0].reduce((m, h, i) => (m[String(h).trim()] = i + 1, m), {});
  const fila = datos.findIndex((f, i) => i > 0 && String(f[col.nombre - 1]).trim().toLowerCase() === nombre);
  if (fila < 1) { ui.alert('No encontré ese usuario.'); return; }

  const sal = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  sh.getRange(fila + 1, col.pin_hash).setValue(sha256Hex_(sal + ':' + pin));
  sh.getRange(fila + 1, col.pin_sal).setValue(sal);
  sh.getRange(fila + 1, col.intentos_fallidos).setValue(0);
  sh.getRange(fila + 1, col.bloqueado_hasta).setValue('');
  ui.alert('PIN asignado. En la hoja solo queda el hash, no el PIN.');
}

function sha256Hex_(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

// Copia las fórmulas (y los textos de referencia) de las pestañas de totales a una pestaña
// "Fórmulas (copia)", para pegarlas en el chat y ajustar los totales con "Anulado".
function copiarFormulas() {
  const ss = SpreadsheetApp.getActive();
  const salida = [['Celda', 'Fórmula o valor']];
  const revisar = { 'Bot': null, 'Resumen': null, 'Listas': null, 'Ventas': 3, 'Gastos': 3, 'Por cobrar': 3 };
  Object.keys(revisar).forEach((nombre) => {
    const sh = ss.getSheetByName(nombre);
    if (!sh) return;
    const filas = revisar[nombre] ? Math.min(revisar[nombre], sh.getLastRow()) : sh.getLastRow();
    if (filas < 1) return;
    const rango = sh.getRange(1, 1, filas, sh.getLastColumn());
    const formulas = rango.getFormulas();
    const valores = rango.getDisplayValues();
    formulas.forEach((fila, i) => fila.forEach((f, j) => {
      const texto = f || valores[i][j];
      // El apóstrofo hace que la fórmula se guarde como texto y no se calcule.
      if (texto) salida.push([`${nombre}!${rango.getCell(i + 1, j + 1).getA1Notation()}`, `'${texto}`]);
    }));
  });
  let destino = ss.getSheetByName('Fórmulas (copia)');
  if (destino) destino.clear(); else destino = ss.insertSheet('Fórmulas (copia)');
  destino.getRange(1, 1, salida.length, 2).setValues(salida);
  destino.autoResizeColumns(1, 2);
  ss.setActiveSheet(destino);
  avisar_('Fórmulas copiadas', `Copia las columnas A y B de "Fórmulas (copia)" y pégalas en el chat. Después puedes borrar esa pestaña.`);
}

function avisar_(titulo, texto) {
  Logger.log(`${titulo}\n${texto}`);
  try { SpreadsheetApp.getUi().alert(titulo, texto, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* corrido sin la hoja abierta */ }
}
