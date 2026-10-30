import { RouterProvider } from '@tanstack/react-router'
import { router } from '@/app/router/router'
import { useTelegramWebApp } from '@/shared/lib/telegram/useTelegramWebApp'

function App() {
  useTelegramWebApp()
  return <RouterProvider router={router} />
}

export default App
