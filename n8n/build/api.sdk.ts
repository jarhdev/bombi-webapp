import { workflow, node, trigger, sticky, switchCase, expr } from '@n8n/workflow-sdk';

const api = trigger({ type: 'n8n-nodes-base.webhook', version: 2.1, config: { name: 'API Bombi',
  parameters: { httpMethod: 'POST', path: 'bombi/:ruta', responseMode: 'responseNode', options: {} } },
  output: [{ params: { ruta: 'resumen' }, headers: { authorization: 'Bearer x' }, body: { periodo: 'hoy' } }] });

const config = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: { name: 'Leer config', executeOnce: true,
  parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'onUWdhiMetL2wanr' }, returnAll: true } },
  output: [{ clave: 'sheet_id', valor: 'abc' }] });

const hojas = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Leer hojas', executeOnce: true, retryOnFail: true, maxTries: 3, onError: 'continueRegularOutput',
  parameters: { url: expr("https://sheets.googleapis.com/v4/spreadsheets/{{ $('Leer config').all().find(i => i.json.clave === 'sheet_id').json.valor }}/values:batchGet?ranges=Usuarios!A%3AJ&ranges=Ventas!A%3AT&ranges=Gastos!A%3AR&ranges='Por%20cobrar'!A%3AR&ranges=Productos!A%3AF&ranges=Tasas!A%3AD&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER"),
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: { timeout: 20000 } }, credentials: { googleSheetsOAuth2Api: { id: 'd9JzMLg0lUmByTRr', name: 'Google Sheets account' } } },
  output: [{ valueRanges: [] }] });

const logica = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Lógica Bombi',
  parameters: { mode: 'runOnceForAllItems', jsCode: 'return [];' } },
  output: [{ paso: 'responder', status: 200, respuesta: { ok: true }, escrituras: [], avisos: [] }] });

const paso = switchCase({ version: 3.2, config: { name: 'Siguiente paso', parameters: { rules: { values: [
  { outputKey: 'escribir', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: expr('{{ $json.paso }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'escribir' } ], combinator: 'and' } },
  { outputKey: 'leer capture', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: expr('{{ $json.paso }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'capture' } ], combinator: 'and' } },
  { outputKey: 'tasa', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: expr('{{ $json.paso }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'tasa' } ], combinator: 'and' } }
] }, options: { fallbackOutput: 'extra', renameFallbackOutput: 'responder' } } } });

const separar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Separar escrituras',
  parameters: { mode: 'runOnceForAllItems', jsCode: "// Convierte las escrituras de \"Lógica Bombi\" en peticiones a la API de Google Sheets:\n// una por pestaña para agregar filas y una sola para actualizar celdas.\nconst out = $('Lógica Bombi').first().json;\nlet sheetId = '';\nfor (const i of $('Leer config').all()) if (i.json.clave === 'sheet_id') sheetId = i.json.valor;\nconst base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values`;\nconst filas = {};\nfor (const e of out.escrituras) if (e.tipo === 'append') (filas[e.hoja] = filas[e.hoja] || []).push(e.fila);\nconst items = Object.entries(filas).map(([hoja, values]) => ({ json: {\n  url: `${base}/${encodeURIComponent(`'${hoja}'!A1`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,\n  body: { values },\n} }));\nconst celdas = out.escrituras.filter((e) => e.tipo === 'update');\nif (celdas.length) items.push({ json: { url: `${base}:batchUpdate`, body: {\n  valueInputOption: 'USER_ENTERED', data: celdas.map((e) => ({ range: e.rango, values: [[e.valor]] })),\n} } });\nreturn items;\n" } }, output: [{ url: 'https://x', body: {} }] });

const escribir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Escribir en Sheets', retryOnFail: true, maxTries: 3, onError: 'continueRegularOutput',
  parameters: { method: 'POST', url: expr('{{ $json.url }}'), authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api',
    sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'), options: { timeout: 20000 } }, credentials: { googleSheetsOAuth2Api: { id: 'd9JzMLg0lUmByTRr', name: 'Google Sheets account' } } },
  output: [{ spreadsheetId: 'x' }] });

const resultado = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Resultado de escritura',
  parameters: { mode: 'runOnceForAllItems', jsCode: "// Si alguna escritura falló, responde con error; si no, responde lo que calculó \"Lógica Bombi\".\nconst out = $('Lógica Bombi').first().json;\nconst fallo = $input.all().some((i) => i.json.error || !i.json.spreadsheetId);\nif (fallo) return [{ json: { status: 502, respuesta: { ok: false, error: 'No se pudo guardar en el Google Sheet. Intenta de nuevo.' }, avisos: [] } }];\nreturn [{ json: { status: out.status, respuesta: out.respuesta, avisos: out.avisos } }];\n" } }, output: [{ status: 200, respuesta: { ok: true }, avisos: [] }] });

const extraer = node({ type: 'n8n-nodes-base.extractFromFile', version: 1, config: { name: 'Imagen a base64',
  parameters: { operation: 'binaryToPropery', binaryPropertyName: 'capture', destinationKey: 'img', options: {} } }, output: [{ img: 'base64' }] });

const prepararLectura = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar lectura',
  parameters: { mode: 'runOnceForAllItems', jsCode: "// Arma la petición a Gemini con la imagen del capture (mismo enfoque que el bot).\nlet modelo = 'gemini-3.1-flash-lite';\nfor (const i of $('Leer config').all()) if (i.json.clave === 'gemini_model' && i.json.valor) modelo = i.json.valor;\nconst item = $input.first();\nconst mime = $('Lógica Bombi').first().binary?.capture?.mimeType || 'image/jpeg';\nconst d = new Date(Date.now() - 4 * 3600e3);\nconst hoy = d.toISOString().slice(0, 10);\nconst sistema = `Eres el asistente de registro de Bombi, un emprendimiento de galletas en Venezuela.\nRecibes la captura de un pago (pago móvil, transferencia, punto de venta, Zelle, Binance, etc.) y devuelves SOLO un objeto JSON, sin texto adicional.\nFormato exacto:\n{\"monto\":0,\"moneda\":\"Bs|USD\",\"fecha\":\"YYYY-MM-DD\",\"metodo\":\"\",\"banco\":\"\",\"referencia\":\"\"}\nReglas:\n- Hoy es ${hoy}. Usa la fecha de la captura si se ve; si no, usa hoy.\n- monto es un número sin separadores de miles: \"1.234,56 Bs\" -> 1234.56.\n- moneda: \"Bs\" para bolívares (pago móvil, transferencia y punto de venta casi siempre son Bs); \"USD\" si dice $, dólares, Zelle o USDT.\n- metodo debe ser uno de: Pago Móvil, Transferencia, Efectivo Bs, Efectivo USD, Zelle, Binance, Punto de venta.\n- referencia: el número de referencia u operación tal como aparece (solo dígitos y letras), o \"\".\n- banco: banco emisor si se ve (Banesco, Mercantil, Venezuela, Provincial, BNC, etc.), o \"\".\n- No inventes datos: deja \"\" o 0 si no se ve.`;\nreturn [{ json: { modelo, body: {\n  system_instruction: { parts: [{ text: sistema }] },\n  contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mime, data: item.json.img } }, { text: 'Captura de pago.' }] }],\n  generationConfig: { temperature: 0, responseMimeType: 'application/json' },\n} } }];\n" } }, output: [{ modelo: 'gemini', body: {} }] });

const gemini = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Gemini lee el capture', retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput',
  parameters: { method: 'POST', url: expr('https://generativelanguage.googleapis.com/v1beta/models/{{ $json.modelo }}:generateContent'),
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.body) }}'), options: { timeout: 30000 } },
  credentials: { httpHeaderAuth: { id: '9nZlpeyvtgcAY3Rf', name: 'Header Auth account' } } }, output: [{ candidates: [] }] });

const interpretar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Interpretar lectura',
  parameters: { mode: 'runOnceForAllItems', jsCode: "// Limpia la respuesta de Gemini y la deja con el formato que espera la app.\nconst METODOS = ['Pago Móvil', 'Transferencia', 'Punto de venta', 'Efectivo Bs', 'Efectivo USD', 'Zelle', 'Binance'];\nconst r = $input.first().json;\nlet raw = (r.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');\nlet d = null;\ntry { d = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch (e) { d = null; }\nif (!d || r.error) return [{ json: { status: 502, respuesta: { ok: false, error: 'No pude leer el capture. Llena los datos a mano.' } } }];\nconst monto = Number(d.monto) || 0;\nreturn [{ json: { status: 200, respuesta: {\n  monto: monto > 0 ? Math.round(monto * 100) / 100 : 0,\n  moneda: d.moneda === 'USD' ? 'USD' : 'Bs',\n  fecha: /^\\d{4}-\\d{2}-\\d{2}$/.test(d.fecha || '') ? d.fecha : '',\n  metodo: METODOS.includes(d.metodo) ? d.metodo : '',\n  banco: String(d.banco || '').trim(),\n  referencia: String(d.referencia || '').replace(/[^0-9A-Za-z]/g, ''),\n} } }];\n" } }, output: [{ status: 200, respuesta: {} }] });

const tasa = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.2, config: { name: 'Actualizar tasa BCV',
  parameters: { mode: 'once', source: 'database', workflowId: { __rl: true, mode: 'id', value: 'xuEUEqwpQBMaOp6w' }, options: { waitForSubWorkflow: true } } },
  output: [{ tasa: 872.39, fecha_valor: '2026-10-06' }] });

const respTasa = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Respuesta de tasa',
  parameters: { mode: 'runOnceForAllItems', jsCode: "// Respuesta de \"Actualizar tasa\" a partir del sub-workflow Bombi · Tasa BCV.\nconst r = $input.first().json;\nif (!(Number(r.tasa) > 0)) return [{ json: { status: 503, respuesta: { ok: false, error: 'No pude consultar la tasa ahora. Intenta más tarde.' } } }];\nreturn [{ json: { status: 200, respuesta: r } }];\n" } }, output: [{ status: 200, respuesta: {} }] });

const responder = node({ type: 'n8n-nodes-base.respondToWebhook', version: 1.4, config: { name: 'Responder a la app',
  parameters: { respondWith: 'json', responseBody: expr('{{ JSON.stringify($json.respuesta) }}'), options: { responseCode: expr('{{ $json.status }}') } } } });

const avisos = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar avisos',
  parameters: { mode: 'runOnceForAllItems', jsCode: "// Un ítem por mensaje de Telegram a enviar (si no hay avisos, no sigue).\nreturn ($input.first().json.avisos || []).map((a) => ({ json: a }));\n" } }, output: [{ chat_id: '1', texto: 'hola' }] });

const telegram = node({ type: 'n8n-nodes-base.telegram', version: 1.2, config: { name: 'Avisar por Telegram', onError: 'continueRegularOutput',
  parameters: { chatId: expr('{{ $json.chat_id }}'), text: expr('{{ $json.texto }}'), additionalFields: { appendAttribution: false } },
  credentials: { telegramApi: { id: 'JFJbwR2h01uWDGEH', name: 'Telegram account' } } }, output: [{ ok: true }] });

const nota = sticky('## Bombi · API webapp\nUna sola URL para la app: POST /webhook/<id>/bombi/<ruta>\nRutas: auth, resumen, tasa, tasa-actualizar, leer-capture, registro, por-cobrar, cobrar, anular, productos, productos-guardar, usuarios, usuarios-accion.\n1. Lee la config (tabla bombi_config) y todas las pestañas del Sheet en una sola llamada.\n2. Lógica Bombi valida la sesión y calcula la respuesta y las filas a escribir (mismo formato que el bot).\n3. Escribe en el Sheet, responde a la app y, si hace falta, avisa por Telegram.\nNo toca el workflow del bot.', [api, logica], { color: 4 });

export default workflow('bombi-api-webapp', 'Bombi · API webapp')
  .add(api).to(config).to(hojas).to(logica)
  .to(paso
    .onCase(0, separar.to(escribir.to(resultado.to(responder))))
    .onCase(1, extraer.to(prepararLectura.to(gemini.to(interpretar.to(responder)))))
    .onCase(2, tasa.to(respTasa.to(responder)))
    .onCase(3, responder))
  .add(responder).to(avisos).to(telegram)
  .add(nota)
  .group('Escribir en el Sheet', [separar, escribir, resultado], { description: 'Agrega filas y actualiza celdas con la API de Google Sheets; si algo falla, la app recibe error.' })
  .group('Leer capture con IA', [extraer, prepararLectura, gemini, interpretar], { description: 'Gemini lee monto, referencia, fecha, método y banco del capture (mismo modelo y credencial que el bot).' })
  .group('Tasa a pedido', [tasa, respTasa], { description: 'Ejecuta el workflow Bombi · Tasa BCV y responde la tasa nueva.' })
  .group('Avisos', [avisos, telegram], { description: 'Después de responder, avisa por Telegram a los admins (por ejemplo, usuario nuevo pendiente).' });
