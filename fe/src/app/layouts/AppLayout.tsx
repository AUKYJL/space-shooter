import { audioManager } from '@/game/audio/AudioManager'
import { ensureBundle, preloadGameAssets, useAssetsStore } from '@/game/assets/assets'
import { LoadingScreen } from '@/shared/ui/LoadingScreen'
import { Link, Outlet, useMatches, useRouterState } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { CircleHelp, Home, Mail, Zap } from 'lucide-react'

import { useRunConfigQuery } from '@/modules/runs/api/runsQueries'
import { useSessionStore } from '@/shared/store/sessionStore'
import { cn } from '@/lib/utils'

const iconLinkBaseClassName =
  'flex size-12 items-center justify-center rounded-xl bg-bg-secondary/70 text-text-secondary transition'

const iconLinkActiveClassName = 'bg-neon-cyan text-bg-primary'
const iconLinkInactiveClassName = ''

export function AppLayout() {
  const menuAssets = useAssetsStore((state) => state.bundles.menu)
  const token = useSessionStore((s) => s.accessToken)
  useRunConfigQuery(Boolean(token))
  useEffect(() => {
    if (token && menuAssets.status === 'idle') void ensureBundle('menu').catch(() => {})
    if (token && menuAssets.status === 'ready') preloadGameAssets()
  }, [token, menuAssets.status])
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const matches = useMatches()
  const mainRef = useRef<HTMLElement | null>(null)
  const normalizePathname = (value: string) =>
    value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value

  const currentPath = normalizePathname(pathname)
  useEffect(() => {
    if (!token || currentPath === '/login' || currentPath === '/run') audioManager.stopMusic()
    else audioManager.playMusic('menu-theme')
  }, [token, currentPath])
  const showBottomNav = !matches.some(
    (match) => (match.staticData as { showBottomNav?: boolean } | undefined)?.showBottomNav === false,
  )
  const navClassName = (to: string) =>
    cn(
      iconLinkBaseClassName,
      currentPath === normalizePathname(to)
        ? iconLinkActiveClassName
        : iconLinkInactiveClassName,
    )

  useEffect(() => {
    const setVh = () => {
      const h = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-vh', `${h * 0.01}px`)
    }

    setVh()

    window.addEventListener('resize', setVh)
    window.addEventListener('orientationchange', setVh)
    window.visualViewport?.addEventListener('resize', setVh)
    window.visualViewport?.addEventListener('scroll', setVh)

    return () => {
      window.removeEventListener('resize', setVh)
      window.removeEventListener('orientationchange', setVh)
      window.visualViewport?.removeEventListener('resize', setVh)
      window.visualViewport?.removeEventListener('scroll', setVh)
    }
  }, [])

  // Prevent diagonal view-transition when switching tabs from a scrolled page:
  // keep scroll position pinned to top for bottom-nav routes.
  useLayoutEffect(() => {
    if (!showBottomNav) return
    mainRef.current?.scrollTo({ top: 0, left: 0 })
  }, [currentPath, showBottomNav])

  if (token && menuAssets.status !== 'ready') {
    return <LoadingScreen label="Loading menu…" progress={menuAssets.progress}
      error={menuAssets.status === 'error' ? 'Failed to load menu assets.' : null} onRetry={() => { void ensureBundle('menu').catch(() => {}) }} />
  }

  return (
    <div
      className={cn(
        'bg-bg-primary',
        'h-[calc(var(--app-vh,1vh)*100)] overflow-hidden',
      )}
    >
      <main
        ref={mainRef}
        className={cn(
          'main-content mx-auto max-w-[420px]',
          showBottomNav
            ? 'tg-safe-pt tg-safe-pb h-full overflow-y-auto px-4 py-5 pb-24'
            : 'h-full p-0',
        )}
      >
        <Outlet />
      </main>

      {showBottomNav ? (
        <nav onClick={(event) => { if ((event.target as Element).closest('a')) audioManager.playSfx('ui_click') }} className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-white/5 bg-bg-primary/70 backdrop-blur">
          <div className="mx-auto flex max-w-[420px] items-center justify-between px-4 py-3">
            <Link to="/" className={navClassName('/')} aria-label="Home">
              <Home className="size-5" />
            </Link>
            <Link to="/upgrades" className={navClassName('/upgrades')} aria-label="Upgrades">
              <Zap className="size-5" />
            </Link>
            <Link to="/stations" className={navClassName('/stations')} aria-label="Stations">
              <CircleHelp className="size-5" />
            </Link>
            <Link to="/inbox" className={navClassName('/inbox')} aria-label="Inbox">
              <Mail className="size-5" />
            </Link>
          </div>
        </nav>
      ) : null}
    </div>
  )
}
