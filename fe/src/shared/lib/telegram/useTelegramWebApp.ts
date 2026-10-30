import { init } from '@telegram-apps/sdk-react'
import { isMobileDevice } from '@/shared/lib/is-mobile-device'
import WebApp from '@twa-dev/sdk'
import { useEffect } from 'react'

export const useTelegramWebApp = () => {
  const isMobile = isMobileDevice()

  useEffect(() => {
    if (WebApp.platform === 'unknown') return

    init()
    WebApp.ready()
    WebApp.expand()

    try {
      if (isMobile) {
        WebApp.requestFullscreen()
        WebApp.disableVerticalSwipes()
      }
    } catch (e) {
      console.error(e)
    }
  }, [isMobile])
}
