import { readFileSync, writeFileSync } from 'node:fs'
const leer = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8')
const src = (...fs) => JSON.stringify(fs.map(leer).join('\n'))
const SHEETS = `{ googleSheetsOAuth2Api: { id: 'd9JzMLg0lUmByTRr', name: 'Google Sheets account' } }`
const COND = (v) => `{ options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: expr('{{ $json.paso }}'), operator: { type: 'string', operation: 'equals' }, rightValue: '${v}' } ], combinator: 'and' }`
const SHEET_ID = `{{ $('Leer config').all().find(i => i.json.clave === 'sheet_id').json.valor }}`
const RANGOS = ['Usuarios!A:J', 'Ventas!A:T', 'Gastos!A:R', "'Por cobrar'!A:S", 'Productos!A:F', 'Tasas!A:D'].map((r) => 'ranges=' + encodeURIComponent(r)).join('&')
const code = `import { workflow, node, trigger, sticky, switchCase, ifElse, expr } from '@n8n/workflow-sdk';

const api = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'API Bombi',
  parameters: { httpMethod: 'POST', path: 'bombi/:ruta', responseMode: 'responseNode', options: {} } },
  output: [{ params: { ruta: 'resumen' }, headers: { authorization: 'Bearer x' }, body: { periodo: 'hoy' } }] });

const config = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: { name: 'Leer config', executeOnce: true,
  parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'onUWdhiMetL2wanr' }, returnAll: true } },
  output: [{ clave: 'sheet_id', valor: 'abc' }] });

const hojas = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Leer hojas', executeOnce: true, retryOnFail: true, maxTries: 3, onError: 'continueRegularOutput',
  parameters: { url: expr("https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchGet?${RANGOS}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER"),
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: { timeout: 20000 } }, credentials: ${SHEETS} },
  output: [{ valueRanges: [] }] });

const logica = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Lógica Bombi',
  parameters: { mode: 'runOnceForAllItems', jsCode: 'return [];' } },
  output: [{ paso: 'responder', status: 200, respuesta: { ok: true }, escrituras: [], avisos: [] }] });

const paso = switchCase({ version: 3.2, config: { name: 'Siguiente paso', parameters: { rules: { values: [
  { outputKey: 'escribir', conditions: ${COND('escribir')} },
  { outputKey: 'leer capture', conditions: ${COND('capture')} },
  { outputKey: 'tasa', conditions: ${COND('tasa')} }
] }, options: { fallbackOutput: 'extra', renameFallbackOutput: 'responder' } } } });

const subir = ifElse({ version: 2.2, config: { name: '¿Subir capture?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [ { leftValue: expr("{{ $('Lógica Bombi').first().json.paso === 'escribir' && !!$('Lógica Bombi').first().json.capture_nombre && Number($json.status) < 300 }}"), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' } ], combinator: 'and' }, options: {} } } });

const prepararSubida = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar subida',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('preparar-subida.js')} } }, output: [{ capture_nombre: 'V-1' }] });

const drive = node({ type: 'n8n-nodes-base.googleDrive', version: 3, config: { name: 'Subir capture a Drive', onError: 'continueRegularOutput',
  parameters: { resource: 'file', operation: 'upload', inputDataFieldName: 'capture', name: expr('{{ $json.capture_nombre }}.jpg'),
    driveId: { __rl: true, mode: 'list', value: 'My Drive' },
    folderId: { __rl: true, mode: 'id', value: expr("{{ $('Leer config').all().find(i => i.json.clave === 'drive_folder_id' && i.json.valor)?.json.valor || 'root' }}") }, options: {} },
  credentials: { googleDriveOAuth2Api: { id: 'U4mYGuaHO0AXg6kz', name: 'Google Drive account' } } }, output: [{ id: 'abc' }] });

const completar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Completar link',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('completar-link.js')} } }, output: [{ url: 'https://x', body: {} }] });

const guardarLink = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Guardar link', retryOnFail: true, maxTries: 3, onError: 'continueRegularOutput',
  parameters: { method: 'POST', url: expr('{{ $json.url }}'), authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
    sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'), options: { timeout: 20000 } }, credentials: ${SHEETS} },
  output: [{ spreadsheetId: 'x' }] });

const separar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Separar escrituras',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('separar-escrituras.js')} } }, output: [{ url: 'https://x', body: {} }] });

const escribir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Escribir en Sheets', retryOnFail: true, maxTries: 3, onError: 'continueRegularOutput',
  parameters: { method: 'POST', url: expr('{{ $json.url }}'), authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
    sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'), options: { timeout: 20000 } }, credentials: ${SHEETS} },
  output: [{ spreadsheetId: 'x' }] });

const resultado = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Resultado de escritura',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('resultado-escritura.js')} } }, output: [{ status: 200, respuesta: { ok: true }, avisos: [] }] });

const extraer = node({ type: 'n8n-nodes-base.extractFromFile', version: 1, config: { name: 'Imagen a base64',
  parameters: { operation: 'binaryToPropery', binaryPropertyName: 'capture', destinationKey: 'img', options: {} } }, output: [{ img: 'base64' }] });

const prepararLectura = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar lectura',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('preparar-lectura.js')} } }, output: [{ modelo: 'gemini', body: {} }] });

const GEMINI = (nombre, modelo, timeout) => node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: nombre, onError: 'continueRegularOutput',
  parameters: { method: 'POST', url: expr('https://generativelanguage.googleapis.com/v1beta/models/{{ ' + modelo + ' }}:generateContent'),
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: expr("{{ JSON.stringify($('Preparar lectura').first().json.body) }}"), options: { timeout } },
  credentials: { httpHeaderAuth: { id: '9nZlpeyvtgcAY3Rf', name: 'Header Auth account' } } }, output: [{ candidates: [] }] });
// Un intento con el principal (20 s) y, si falla, uno con el respaldo (15 s): la app recibe respuesta antes de sus 45 s.
const gemini = GEMINI('Gemini lee el capture', "$('Preparar lectura').first().json.modelo", 20000);
const leyo = ifElse({ version: 2.2, config: { name: '¿Gemini respondió?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [ { leftValue: expr('{{ !$json.error && ($json.candidates?.[0]?.content?.parts || []).some(p => p.text) }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' } ], combinator: 'and' }, options: {} } } });
const respaldo = GEMINI('Gemini respaldo', "$('Preparar lectura').first().json.respaldo", 15000);

const interpretar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Interpretar lectura',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('interpretar-lectura.js')} } }, output: [{ status: 200, respuesta: {} }] });

const tasa = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.2, config: { name: 'Actualizar tasa BCV',
  parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: 'xuEUEqwpQBMaOp6w' }, options: { waitForSubWorkflow: true } } },
  output: [{ tasa: 872.39, fecha_valor: '2026-10-06' }] });

const respTasa = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Respuesta de tasa',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('responder-tasa.js')} } }, output: [{ status: 200, respuesta: {} }] });

const responder = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.4, config: { name: 'Responder a la app',
  parameters: { respondWith: 'json', responseBody: expr('{{ JSON.stringify($json.respuesta) }}'), options: { responseCode: expr('{{ $json.status }}') } } } });

const avisos = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar avisos',
  parameters: { mode: 'runOnceForAllItems', jsCode: ${src('preparar-avisos.js')} } }, output: [{ chat_id: '1', texto: 'hola' }] });

const telegram = node({ type: 'n8n-nodes-base.telegram', version: 1.2, config: { name: 'Avisar por Telegram', onError: 'continueRegularOutput',
  parameters: { chatId: expr('{{ $json.chat_id }}'), text: expr('{{ $json.texto }}'), additionalFields: { appendAttribution: false } },
  credentials: { telegramApi: { id: 'JFJbwR2h01uWDGEH', name: 'Telegram account' } } }, output: [{ ok: true }] });

const nota = sticky('## Bombi · API webapp\\nUna sola URL para la app: POST /webhook/<id>/bombi/<ruta>\\nRutas: auth, resumen, tasa, tasa-actualizar, leer-capture, registro, por-cobrar, cobrar, anular, productos, productos-guardar, usuarios, usuarios-accion.\\n1. Lee la config (tabla bombi_config) y todas las pestañas del Sheet en una sola llamada.\\n2. Lógica Bombi valida la sesión y calcula la respuesta y las filas a escribir (mismo formato que el bot).\\n3. Escribe en el Sheet, responde a la app y, si hace falta, avisa por Telegram.\\nNo toca el workflow del bot.', [api, logica], { color: 4 });

export default workflow('bombi-api-webapp', 'Bombi · API webapp')
  .add(api).to(config).to(hojas).to(logica)
  .to(paso
    .onCase(0, separar)
    .onCase(1, extraer.to(prepararLectura.to(gemini.to(leyo.onTrue(interpretar).onFalse(respaldo.to(interpretar))))))
    .onCase(2, tasa.to(respTasa.to(responder)))
    .onCase(3, responder))
  .add(separar).to(escribir.to(resultado.to(responder)))
  .add(interpretar).to(responder)
  .add(responder).to(avisos).to(telegram)
  .add(responder).to(subir.onTrue(prepararSubida.to(drive.to(completar.to(guardarLink)))))
  .add(nota)
  .group('Escribir en el Sheet', [separar, escribir, resultado], { description: 'Agrega filas y actualiza celdas con la API de Google Sheets; si algo falla, la app recibe error.' })
  .group('Capture a Drive', [subir, prepararSubida, drive, completar, guardarLink], { description: 'Después de responder: sube el capture a Drive y completa Link capture. Si Drive tarda o falla, el registro ya está guardado.' })
  .group('Leer capture con IA', [extraer, prepararLectura, gemini, leyo, respaldo, interpretar], { description: 'Gemini lee monto, referencia, fecha, método y banco del capture; si el modelo principal falla, usa el de respaldo.' })
  .group('Tasa a pedido', [tasa, respTasa], { description: 'Ejecuta el workflow Bombi · Tasa BCV y responde la tasa nueva.' })
  .group('Avisos', [avisos, telegram], { description: 'Después de responder, avisa por Telegram a los admins (por ejemplo, usuario nuevo pendiente).' });
`
writeFileSync(new URL('./api.sdk.ts', import.meta.url), code)
console.log(code.length)
writeFileSync(new URL('./logica.jscode.json', import.meta.url), src('cripto.js', 'logica.js', 'envoltorio.js'))
