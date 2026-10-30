import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSessionStore } from '@/shared/store/sessionStore'
import { router } from '@/app/router/router'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => useSessionStore.subscribe((state, previous) => {
    if (previous.accessToken && !state.accessToken) {
      void queryClient.cancelQueries()
      queryClient.clear()
      void router.navigate({ to: '/login', replace: true })
    }
  }), [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

