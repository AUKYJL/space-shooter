import {
  createRootRoute,
  createRoute,
  createRouter,
  createBrowserHistory,
  createHashHistory,
  redirect,
} from '@tanstack/react-router'

import { AppLayout } from '@/app/layouts/AppLayout'
import { DevLoginPage } from '@/modules/auth/ui/DevLoginPage'
import { HelpPage } from '@/modules/help/HelpPage'
import { InboxPage } from '@/modules/inbox/InboxPage'
import { WeaponSelectPage } from '@/modules/loadout/WeaponSelectPage'
import { MainMenuPage } from '@/modules/menu/MainMenuPage'
import { RunPage } from '@/modules/runs/RunPage'
import { StationsPage } from '@/modules/stations/StationsPage'
import { UpgradesPage } from '@/modules/upgrades/UpgradesPage'
import { useSessionStore } from '@/shared/store/sessionStore'

const rootRoute = createRootRoute({
  component: AppLayout,
  beforeLoad: ({ location }) => {
    const token = useSessionStore.getState().accessToken
    const isLoginRoute = location.pathname === '/login-dev'

    if (!token && !isLoginRoute) {
      throw redirect({ to: '/login-dev' })
    }

    if (token && isLoginRoute) {
      throw redirect({ to: '/' })
    }
  },
})

const loginDevRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login-dev',
  component: DevLoginPage,
  staticData: {
    showBottomNav: false,
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MainMenuPage,
})

const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/run',
  component: RunPage,
  staticData: {
    showBottomNav: false,
  },
})

const upgradesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upgrades',
  component: UpgradesPage,
})

const loadoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/loadout',
  component: WeaponSelectPage,
  staticData: {
    showBottomNav: false,
  },
})

const stationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stations',
  component: StationsPage,
})

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: HelpPage,
})

const inboxRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inbox',
  component: InboxPage,
})

const routeTree = rootRoute.addChildren([
  loginDevRoute,
  indexRoute,
  runRoute,
  upgradesRoute,
  loadoutRoute,
  stationsRoute,
  helpRoute,
  inboxRoute,
])

export const router = createRouter({
  routeTree,
  history:
    typeof window !== 'undefined' && window.location.protocol === 'file:' ? createHashHistory() : createBrowserHistory(),
  defaultPreload: 'intent',
  defaultViewTransition: {
    types: ({ fromLocation, toLocation, pathChanged }) => {
      if (!pathChanged) return false

      const normalizePathname = (pathname: string) =>
        pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

      // Bottom nav routes: transition direction based on their relative order
      // (not history direction) so that clicking "left tab" slides left and
      // clicking "right tab" slides right.
      const bottomNavOrder: Record<string, number> = {
        '/': 0,
        '/upgrades': 1,
        '/stations': 2,
        '/inbox': 3,
      }

      const fromPath = fromLocation?.pathname ? normalizePathname(fromLocation.pathname) : undefined
      const toPath = normalizePathname(toLocation.pathname)

      const fromNavIndex = fromPath ? bottomNavOrder[fromPath] : undefined
      const toNavIndex = bottomNavOrder[toPath]

      if (typeof fromNavIndex === 'number' && typeof toNavIndex === 'number') {
        if (toNavIndex === fromNavIndex) return false
        return toNavIndex < fromNavIndex ? ['slide-right'] : ['slide-left']
      }

      const fromIndex = fromLocation?.state?.__TSR_index
      const toIndex = toLocation?.state?.__TSR_index

      if (typeof fromIndex === 'number' && typeof toIndex === 'number') {
        return toIndex < fromIndex ? ['slide-right'] : ['slide-left']
      }

      return ['slide-left']
    },
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
