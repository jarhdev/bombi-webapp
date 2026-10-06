// Id único por envío: si la persona toca "Guardar" dos veces, n8n descarta el repetido.
export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
