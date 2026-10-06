// Integración con Telegram Mini App (telegram-web-app.js se carga en index.html).
const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

// Dentro de Telegram, initData viene firmado por Telegram; fuera de Telegram está vacío.
export const enTelegram = Boolean(tg?.initData)
export const initData = tg?.initData || ''

export function iniciarTelegram() {
  if (!enTelegram) return
  tg.ready()
  tg.expand()
  // Colores de la marca, no los del tema de Telegram.
  try {
    tg.setHeaderColor('#f4e9d6')
    tg.setBackgroundColor('#f4e9d6')
    tg.setBottomBarColor?.('#f4e9d6')
  } catch { /* versiones viejas de Telegram */ }
  tg.disableVerticalSwipes?.()
}

export function vibrar(tipo = 'success') {
  try {
    if (tipo === 'light') tg?.HapticFeedback?.impactOccurred('light')
    else tg?.HapticFeedback?.notificationOccurred(tipo)
  } catch { /* */ }
}

// Botón "atrás" nativo de Telegram.
export function botonAtras(onBack) {
  if (!enTelegram || !tg.BackButton) return () => {}
  if (!onBack) {
    tg.BackButton.hide()
    return () => {}
  }
  tg.BackButton.show()
  tg.BackButton.onClick(onBack)
  return () => tg.BackButton.offClick(onBack)
}
