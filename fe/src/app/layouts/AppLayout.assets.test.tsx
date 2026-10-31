import { audioManager } from '@/game/audio/AudioManager'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/game/audio/AudioManager', () => ({ audioManager: { stopMusic: vi.fn(), playMusic: vi.fn(), playSfx: vi.fn() } }))
const route = vi.hoisted(() => ({ path: '/' }))
const pixi = vi.hoisted(() => ({ init: vi.fn(async () => {}), loadBundle: vi.fn(), load: vi.fn(async () => ({})) }))
vi.mock('pixi.js', () => ({ Assets: pixi }))
vi.mock('@pixi/sound', () => ({ utils: { supported: { ogg: true } } }))
vi.mock('@/modules/runs/api/runsQueries', () => ({ useRunConfigQuery: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => route.path, useMatches: () => [], Outlet: () => <div>Main screen</div>,
  Link: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
import { AppLayout } from './AppLayout'
import { useAssetsStore } from '@/game/assets/assets'
import { BUNDLE_URLS, type AssetBundle } from '@/game/assets/assetManifest'
import { useSessionStore } from '@/shared/store/sessionStore'

beforeEach(() => {
  route.path = '/'
  vi.mocked(audioManager.playMusic).mockClear()
  vi.mocked(audioManager.stopMusic).mockClear()
  HTMLElement.prototype.scrollTo = vi.fn()
  pixi.loadBundle.mockReset().mockResolvedValue({})
  useSessionStore.setState({ accessToken: null })
  useAssetsStore.setState({ bundles: Object.fromEntries(Object.keys(BUNDLE_URLS).map((name) => [name, {
    status: 'idle', progress: 0, error: null,
  }])) as ReturnType<typeof useAssetsStore.getState>['bundles'] })
})
afterEach(cleanup)

describe('authenticated asset shell', () => {
  it('does not load game assets for login', () => {
    render(<StrictMode><AppLayout /></StrictMode>)
    expect(screen.getByText('Main screen')).toBeInTheDocument()
    expect(pixi.loadBundle).not.toHaveBeenCalled()
  })
  it('waits only for menu and keeps the menu usable when background assets fail', async () => {
    let finish!: () => void
    pixi.loadBundle.mockImplementation((name: AssetBundle, progress: (value: number) => void) => {
      if (name === 'menu') return new Promise<void>((done) => { finish = done; progress(0.5) })
      if (name === 'ship') return Promise.reject(new Error('background offline'))
      return Promise.resolve({})
    })
    useSessionStore.setState({ accessToken: 'test' })
    render(<StrictMode><AppLayout /></StrictMode>)
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50'))
    expect(screen.queryByText('Main screen')).not.toBeInTheDocument()
    expect(pixi.loadBundle).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await screen.findByText('Main screen')
    await waitFor(() => expect(useAssetsStore.getState().bundles.ship.status).toBe('error'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('retries menu failures before displaying the shell', async () => {
    pixi.loadBundle.mockRejectedValueOnce(new Error('menu offline')).mockResolvedValue({})
    useSessionStore.setState({ accessToken: 'test' })
    render(<AppLayout />)
    await screen.findByText('Failed to load menu assets.')
    await act(async () => screen.getByRole('button', { name: 'Retry' }).click())
    await screen.findByText('Main screen')
    await waitFor(() => expect(useAssetsStore.getState().bundles.extraction.status).toBe('ready'))
  })
})

it('keeps menu music across sections, stops on run/login and restores on exit', () => {
  useSessionStore.setState({ accessToken: 'test' })
  const { rerender } = render(<AppLayout />)
  expect(audioManager.playMusic).toHaveBeenLastCalledWith('menu-theme')
  route.path = '/upgrades'
  rerender(<AppLayout />)
  expect(audioManager.playMusic).toHaveBeenLastCalledWith('menu-theme')
  route.path = '/run'
  rerender(<AppLayout />)
  expect(audioManager.stopMusic).toHaveBeenCalledOnce()
  route.path = '/'
  rerender(<AppLayout />)
  expect(audioManager.playMusic).toHaveBeenLastCalledWith('menu-theme')
  route.path = '/login'
  rerender(<AppLayout />)
  expect(audioManager.stopMusic).toHaveBeenCalledTimes(2)
})
