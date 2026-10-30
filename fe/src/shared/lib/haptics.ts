type TelegramHapticsImpactStyle = 'light' | 'medium' | 'heavy'

type TelegramWebApp = {
  HapticFeedback?: {
    impactOccurred?: (style: TelegramHapticsImpactStyle) => void
  }
}

function getTelegramWebApp(): TelegramWebApp | null {
  const g = globalThis as unknown as { Telegram?: { WebApp?: TelegramWebApp } }
  return g.Telegram?.WebApp ?? null
}

export const haptics = {
  tap() {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.('light')
  },
  damage() {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.('medium')
  },
  chargeShot() {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.('heavy')
  },
}
