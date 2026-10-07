import { workflow, node, trigger, sticky, ifElse, switchCase, expr } from '@n8n/workflow-sdk';

const horario = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3, config: { name: 'Dos veces al día', parameters: { rule: { interval: [ { field: 'cronExpression', expression: '0 35 8,16 * * *' } ] } } } });
const llamada = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1, config: { name: 'Llamada desde la API', parameters: { inputSource: 'passthrough' } } });

const dolarapi = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Consultar dolarapi', retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput',
  parameters: { url: 'https://ve.dolarapi.com/v1/dolares/oficial', options: { timeout: 15000 } } }, output: [{ promedio: 872.3927, fechaActualizacion: '2026-10-06T00:00:00-04:00' }] });

const okApi = ifElse({ version: 2.2, config: { name: '¿dolarapi respondió?', parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [ { leftValue: expr('{{ Number($json.promedio) || 0 }}'), operator: { type: 'number', operation: 'gt' }, rightValue: 0 } ], combinator: 'and' } } } });

const bcv = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Consultar BCV', onError: 'continueRegularOutput',
  parameters: { url: 'https://www.bcv.org.ve/', options: { allowUnauthorizedCerts: true, timeout: 20000, response: { response: { responseFormat: 'text' } } } } }, output: [{ data: '<html></html>' }] });

const config = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: { name: 'Leer config', executeOnce: true,
  parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'onUWdhiMetL2wanr' }, returnAll: true } }, output: [{ clave: 'sheet_id', valor: 'abc' }] });

const leer = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Leer tasas y admins', executeOnce: true, retryOnFail: true, onError: 'continueRegularOutput',
  parameters: { url: expr("https://sheets.googleapis.com/v4/spreadsheets/{{ $('Leer config').all().find(i => i.json.clave === 'sheet_id').json.valor }}/values:batchGet?ranges=Tasas!A:D&ranges=Usuarios!A:J&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER"),
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', options: {} }, credentials: { googleSheetsOAuth2Api: { id: 'd9JzMLg0lUmByTRr', name: 'Google Sheets account' } } }, output: [{ valueRanges: [] }] });

const decidir = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Decidir tasa', parameters: { mode: 'runOnceForAllItems', jsCode: "// Decide qué tasa usar: dolarapi -> página del BCV -> última guardada (y avisa a los admins).\nconst p = (n) => String(n).padStart(2, '0');\nconst d = new Date(Date.now() - 4 * 3600e3);\nconst consultada = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;\nconst tomar = (nombre) => { try { return $(nombre).first().json; } catch (e) { return null; } };\nlet nueva = null;\nconst api = tomar('Consultar dolarapi');\nif (api && Number(api.promedio) > 0) nueva = { tasa: Number(api.promedio), fecha_valor: String(api.fechaActualizacion || '').slice(0, 10), fuente: 'dolarapi (BCV)' };\nif (!nueva) {\n  const html = String(tomar('Consultar BCV')?.data || '');\n  const m = html.match(/id=\"dolar\"[\\s\\S]*?<strong>\\s*([\\d.,]+)\\s*<\\/strong>/);\n  const f = html.match(/Fecha Valor:[\\s\\S]*?content=\"(\\d{4}-\\d{2}-\\d{2})/);\n  if (m) nueva = { tasa: Number(m[1].replace(/\\./g, '').replace(',', '.')), fecha_valor: f ? f[1] : consultada.slice(0, 10), fuente: 'bcv.org.ve' };\n}\nconst vr = tomar('Leer tasas y admins')?.valueRanges || [];\nconst filas = (vr[0]?.values || []).slice(1).filter((r) => Number(r[1]) > 0);\nconst ult = filas[filas.length - 1];\nconst serial = (v) => (typeof v === 'number' ? new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5).toISOString().slice(0, 10) : String(v || '').slice(0, 10));\nconst ultima = ult ? { tasa: Number(ult[1]), fecha_valor: serial(ult[0]), fuente: String(ult[2] || ''), consultada: String(ult[3] || '') } : null;\nconst usuarios = vr[1]?.values || [];\nconst enc = (usuarios[0] || []).map(String);\nconst col = (n) => enc.indexOf(n);\nconst admins = usuarios.slice(1).filter((r) => r[col('rol')] === 'admin' && r[col('estado')] === 'activo' && String(r[col('telegram_id')] || '').trim()).map((r) => String(r[col('telegram_id')]).trim());\nif (!nueva) {\n  return [{ json: { accion: 'avisar', avisos: admins.map((chat_id) => ({ chat_id, texto: `No pude consultar la tasa BCV (${consultada}). La app sigue usando la última guardada${ultima ? `: Bs. ${ultima.tasa}` : ''}.` })),\n    resultado: ultima ? { ...ultima, sin_cambios: true, aviso: 'No se pudo consultar la tasa nueva.' } : { tasa: 0 } } }];\n}\nif (ultima && Math.abs(ultima.tasa - nueva.tasa) < 1e-6 && ultima.fecha_valor === nueva.fecha_valor) {\n  return [{ json: { accion: 'nada', resultado: { ...ultima, sin_cambios: true } } }];\n}\nreturn [{ json: { accion: 'guardar', fila: [nueva.fecha_valor, nueva.tasa, nueva.fuente, \"'\" + consultada], resultado: { ...nueva, consultada, sin_cambios: false } } }];\n" } }, output: [{ accion: 'guardar', fila: [], resultado: { tasa: 1 } }] });

const ruta = switchCase({ version: 3.2, config: { name: '¿Qué hacer?', parameters: { rules: { values: [
  { outputKey: 'guardar', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: expr('{{ $json.accion }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'guardar' } ], combinator: 'and' } },
  { outputKey: 'avisar', conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [ { leftValue: expr('{{ $json.accion }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'avisar' } ], combinator: 'and' } }
] }, options: { fallbackOutput: 'extra', renameFallbackOutput: 'sin cambios' } } } });

const guardar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.2, config: { name: 'Guardar en Tasas', retryOnFail: true, onError: 'continueRegularOutput',
  parameters: { method: 'POST', url: expr("https://sheets.googleapis.com/v4/spreadsheets/{{ $('Leer config').all().find(i => i.json.clave === 'sheet_id').json.valor }}/values/Tasas!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS"),
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleSheetsOAuth2Api', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ values: [$json.fila] }) }}'), options: {} }, credentials: { googleSheetsOAuth2Api: { id: 'd9JzMLg0lUmByTRr', name: 'Google Sheets account' } } }, output: [{ spreadsheetId: 'x' }] });

const separarAvisos = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Un aviso por admin', parameters: { mode: 'runOnceForAllItems', jsCode: 'return ($input.first().json.avisos || []).map((a) => ({ json: a }));' } }, output: [{ chat_id: '1', texto: 'hola' }] });

const avisar = node({ type: 'n8n-nodes-base.telegram', version: 1.2, config: { name: 'Avisar a admins', onError: 'continueRegularOutput',
  parameters: { chatId: expr('{{ $json.chat_id }}'), text: expr('{{ $json.texto }}'), additionalFields: { appendAttribution: false } }, credentials: { telegramApi: { id: 'JFJbwR2h01uWDGEH', name: 'Telegram account' } } }, output: [{ ok: true }] });

const resultado = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Resultado tasa', parameters: { mode: 'runOnceForAllItems', jsCode: "return [{ json: $('Decidir tasa').first().json.resultado }];" } }, output: [{ tasa: 872.39, fecha_valor: '2026-10-06' }] });

const nota = sticky('## Bombi · Tasa BCV\nConsulta la tasa oficial a las 8:35 y 16:35 (hora de Caracas) y cuando la app pide actualizarla.\n1. dolarapi (campo promedio, fechaActualizacion = fecha valor).\n2. Si falla, lee la página del BCV.\n3. Si todo falla, sigue con la última guardada y avisa a los admins por Telegram.\nSolo agrega fila en la pestaña Tasas si la tasa o la fecha valor cambiaron.', [dolarapi, decidir], { color: 4 });

export default workflow('bombi-tasa-bcv', 'Bombi · Tasa BCV')
  .add(horario).to(dolarapi)
  .add(llamada).to(dolarapi)
  .add(dolarapi).to(okApi.onTrue(config).onFalse(bcv.to(config)))
  .add(config).to(leer).to(decidir)
  .to(ruta.onCase(0, guardar.to(resultado)).onCase(1, separarAvisos.to(avisar.to(resultado))).onCase(2, resultado))
  .add(nota);
