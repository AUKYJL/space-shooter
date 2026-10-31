import { audioManager } from '@/game/audio/AudioManager'
import { qk } from '@/shared/api/queryKeys'
import { ensureRunAssets, getRunAssetState, useAssetsStore, type AssetLoadState } from '@/game/assets/assets'
import { RUN_CONFIG, GAMEPLAY_CONFIG, WEAPON_TUNING } from '@/test/runConfig'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap, RunHudState, RunSummary } from '@/game/ui-bridge/gameToReact'
import { useAppStore } from '@/shared/store/appStore'
import { RunPage } from './RunPage'
import { finishRun, getRunConfig, startRun, type ScoringConfig, type StartRunResponse } from './api/runsApi'

vi.mock('@/game/audio/AudioManager', () => ({ audioManager: { stopAll: vi.fn(), stopSfx: vi.fn(), stopMusic: vi.fn(), startRunMusic: vi.fn(), resume: vi.fn(), pause: vi.fn(), finishRun: vi.fn(), playSfx: vi.fn() } }))
vi.mock('@/game/assets/assets', async () => {
  const { create } = await import('zustand')
  return {
    useAssetsStore: create(() => ({ bundles: {} })),
    ensureRunAssets: vi.fn(async () => {}),
    getRunAssetState: vi.fn((): AssetLoadState => ({ status: 'ready', progress: 1, error: null })),
  }
})
const bridge = vi.hoisted(() => ({ events: null as EventBus<RunBridgeEventMap> | null, runId: '', failCanvas: false, holdCanvas: false, onReady: () => {} }))
vi.mock('./api/runsApi', () => ({ getRunConfig: vi.fn(), startRun: vi.fn(), finishRun: vi.fn() }))
vi.mock('./GameCanvas', () => ({ GameCanvas: (props: { events: EventBus<RunBridgeEventMap>; init: StartRunResponse & { scoringConfig: ScoringConfig }; onReady: () => void; onError: (error: Error) => void }) => {
  const { onReady, onError } = props
  bridge.onReady = onReady
  useEffect(() => {
    if (bridge.failCanvas) onError(new Error('renderer unavailable'))
    else if (!bridge.holdCanvas) onReady()
  }, [onReady, onError])
  bridge.events = props.events; bridge.runId = props.init.runId
  return <div data-testid="canvas">{props.init.runId}</div>
} }))
vi.mock('./RunHud', () => ({ RunHud: ({ model }: { model: RunHudState }) => <div data-testid="hud">{model.score}/{model.stage}/{model.coins}</div> }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@/shared/ui/drawer', () => ({
  Drawer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const config = structuredClone(RUN_CONFIG)
const initial = { runId: 'one', seed: 1, scoringConfigVersion: 7, snapshot: { weaponId: 'basic_laser', damage: 1, fireRate: 2, maxHp: 5, scoringConfig: config, gameplayConfig: GAMEPLAY_CONFIG, weaponTuning: WEAPON_TUNING } }
const summary: RunSummary = { score: 110, stageReached: 1, durationMs: 20_000, endedBy: 'death', extractionCount: 0, multiplier: 1,
  collected: { coins: 10, iron: 2, gold: 0, crystal: 1 }, banked: { coins: 0, iron: 0, gold: 0, crystal: 0 },
  enemiesDestroyed: { sentryTurret: 0 },
  destroyed: { normal: 1, fast: 1, big: 1, armored: 1 } }
const result = { accepted: true, score: 110, bestScore: 110, grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } }
function mount(bestScore?: number) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  if (bestScore !== undefined) client.setQueryData(qk.me(), { bestScore })
  return render(<StrictMode><QueryClientProvider client={client}><RunPage /></QueryClientProvider></StrictMode>)
}
beforeEach(() => {
  vi.resetAllMocks()
  bridge.failCanvas = false
  bridge.holdCanvas = false
  vi.mocked(getRunAssetState).mockReturnValue({ status: 'ready', progress: 1, error: null })
  useAppStore.setState({ selectedWeaponId: 'basic_laser', lastRunSummary: null })
  vi.mocked(getRunConfig).mockResolvedValue(config)
  vi.mocked(startRun).mockResolvedValueOnce(initial).mockResolvedValueOnce({ ...initial, runId: 'two' })
  vi.mocked(finishRun).mockResolvedValue(result)
})
afterEach(cleanup)

describe('run page', () => {
  it('starts exactly once in StrictMode', async () => {
    mount()
    await screen.findByText('one')
    expect(getRunConfig).toHaveBeenCalledTimes(1)
    expect(startRun).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Starting run…')).not.toBeInTheDocument()
  })
  it('waits for assets before starting and retries asset errors separately', async () => {
    vi.mocked(getRunAssetState).mockReturnValue({ status: 'loading', progress: 0.5, error: null })
    mount()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(startRun).not.toHaveBeenCalled()
    act(() => {
      vi.mocked(getRunAssetState).mockReturnValue({ status: 'error', progress: 0.5, error: new Error('assets offline') })
      useAssetsStore.setState(({ bundles }) => ({ bundles: { ...bundles } }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load game assets.')
    vi.mocked(ensureRunAssets).mockImplementation(async () => {
      vi.mocked(getRunAssetState).mockReturnValue({ status: 'ready', progress: 1, error: null })
      useAssetsStore.setState(({ bundles }) => ({ bundles: { ...bundles } }))
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('one')
    expect(startRun).toHaveBeenCalledOnce()
  })
  it('preserves a background asset error until explicit retry', async () => {
    vi.mocked(getRunAssetState).mockReturnValue({ status: 'error', progress: 0.3, error: new Error('preload failed') })
    mount()
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load game assets.')
    expect(ensureRunAssets).not.toHaveBeenCalled()
    expect(startRun).not.toHaveBeenCalled()
  })
  it('retries canvas initialization without creating another server run', async () => {
    bridge.failCanvas = true
    mount()
    await screen.findByText('Failed to initialize game.')
    expect(screen.queryByTestId('hud')).not.toBeInTheDocument()
    bridge.failCanvas = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByTestId('hud')
    expect(startRun).toHaveBeenCalledOnce()
    expect(bridge.runId).toBe('one')
  })
  it('keeps HUD controls hidden until the canvas reports ready', async () => {
    bridge.holdCanvas = true
    mount()
    await screen.findByText('Preparing game…')
    expect(screen.queryByTestId('hud')).not.toBeInTheDocument()
    act(() => bridge.onReady())
    expect(screen.getByTestId('hud')).toBeInTheDocument()
  })
  it('does not create Pixi or display local HUD defaults for an incomplete snapshot', async () => {
    const invalid = JSON.parse(JSON.stringify(initial))
    delete invalid.snapshot.gameplayConfig
    vi.mocked(startRun).mockReset().mockResolvedValue(invalid)
    mount()
    await screen.findByText('Failed to start run: Invalid run configuration: gameplay')
    expect(screen.queryByTestId('canvas')).not.toBeInTheDocument()
    expect(screen.queryByTestId('hud')).not.toBeInTheDocument()
  })
  it('shows a start error and allows retry in StrictMode', async () => {
    vi.mocked(startRun).mockReset().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(initial)
    mount()
    await screen.findByText('Failed to start run: offline')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('one')
    expect(startRun).toHaveBeenCalledTimes(2)
  })
  it('shows server score and grants, then restarts with fresh scene/HUD/payload', async () => {
    mount()
    await screen.findByText('one')
    act(() => bridge.events?.emit('run:hud-update', { score: 110, stage: 2, coins: 10 } as RunHudState))
    expect(screen.getByTestId('hud')).toHaveTextContent('110/2/10')
    act(() => bridge.events?.emit('run:finished', summary))
    await screen.findByText('110')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play Again' })).toBeEnabled())
    expect(finishRun).toHaveBeenCalledWith(expect.objectContaining({ runId: 'one', summary: expect.objectContaining({
      destroyedByType: summary.destroyed, stageReached: 1,
    }) }), expect.anything())
    expect(screen.getByText('Resources Granted')).toBeInTheDocument()
    expect(screen.getByText('Crystals x0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }))
    await screen.findByText('two')
    expect(audioManager.startRunMusic).toHaveBeenCalledWith('two')
    expect(audioManager.stopMusic).toHaveBeenCalled()
    expect(useAppStore.getState().lastRunSummary).toBeNull()
    expect(screen.getByTestId('hud')).toHaveTextContent('0/1/0')
    act(() => bridge.events?.emit('run:finished', summary))
    await waitFor(() => expect(finishRun).toHaveBeenCalledTimes(2))
    expect(vi.mocked(finishRun).mock.calls[1][0].runId).toBe('two')
  })
  it('sends enemy counts separately and never sends a client score', async () => {
    mount()
    await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', { ...summary, score: 999999, enemiesDestroyed: { sentryTurret: 2, shieldDrone: 1, mineLayer: 3 } }))
    await waitFor(() => expect(finishRun).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(finishRun).mock.calls[0][0]
    expect(payload.summary.enemiesDestroyed).toEqual({ sentryTurret: 2, shieldDrone: 1, mineLayer: 3 })
    expect(payload.summary.asteroidsDestroyed).toBe(4)
    expect(payload.summary.destroyedByType).toEqual(summary.destroyed)
    expect(payload).not.toHaveProperty('score')
    expect(payload.summary).not.toHaveProperty('score')
  })
  it('blocks exit and restart while confirming, then displays a rejected result', async () => {
    let resolve!: (value: typeof result) => void
    vi.mocked(finishRun).mockReturnValue(new Promise((done) => { resolve = done }))
    mount(); await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', summary))
    await screen.findByText('Confirming result…')
    expect(screen.getByRole('button', { name: 'Play Again' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Exit to Menu' })).toBeDisabled()
    await act(async () => resolve({ ...result, accepted: false, score: 120 }))
    expect(await screen.findByText('120')).toBeInTheDocument()
    expect(screen.getByText(/Result rejected/)).toBeInTheDocument()
  })
  it('retries the same payload and runId after a failed finish', async () => {
    vi.mocked(finishRun).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result)
    mount(); await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', summary))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play Again' })).toBeEnabled())
    expect(vi.mocked(finishRun).mock.calls[1][0]).toEqual(vi.mocked(finishRun).mock.calls[0][0])
    expect(startRun).toHaveBeenCalledTimes(1)
  })
})

describe('run result SFX', () => {
  it('uses the death or extraction result cue once per finished event', async () => {
    mount()
    await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', summary))
    expect(audioManager.finishRun).toHaveBeenCalledWith('death')
    await waitFor(() => expect(finishRun).toHaveBeenCalledOnce())
  })
  it('plays a confirmed new record once, including after a failed finish request', async () => {
    vi.mocked(finishRun).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result)
    mount(100)
    await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', summary))
    await screen.findByText('Could not save result.')
    expect(audioManager.playSfx).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(audioManager.playSfx).toHaveBeenCalledWith('new_record'))
    expect(vi.mocked(audioManager.playSfx).mock.calls.filter(([id]) => id === 'new_record')).toHaveLength(1)
    // A repeated finished notification must not replay the record cue.
    act(() => bridge.events?.emit('run:finished', summary))
    await waitFor(() => expect(finishRun).toHaveBeenCalledTimes(3))
    expect(vi.mocked(audioManager.playSfx).mock.calls.filter(([id]) => id === 'new_record')).toHaveLength(1)
  })
  it.each([undefined, 110, 200])('does not announce an unknown, tied or lower record (previous=%s)', async (previous) => {
    mount(previous)
    await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', summary))
    await screen.findByRole('button', { name: 'Play Again' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Play Again' })).toBeEnabled())
    expect(audioManager.playSfx).not.toHaveBeenCalledWith('new_record')
  })
  it('does not announce a rejected result', async () => {
    vi.mocked(finishRun).mockResolvedValue({ ...result, accepted: false })
    mount(100)
    await screen.findByText('one')
    act(() => bridge.events?.emit('run:finished', summary))
    await screen.findByText('Result rejected. No rewards or record update.')
    expect(audioManager.playSfx).not.toHaveBeenCalledWith('new_record')
  })
})

it('starts music only when the canvas is ready and cleans SFX on exit', async () => {
  bridge.holdCanvas = true
  const view = mount()
  await screen.findByText('one')
  expect(audioManager.startRunMusic).not.toHaveBeenCalled()
  act(() => bridge.onReady())
  await waitFor(() => expect(audioManager.startRunMusic).toHaveBeenCalledWith('one'))
  act(() => bridge.events?.emit('run:finished', summary))
  expect(audioManager.finishRun).toHaveBeenCalledWith('death')
  view.unmount()
  expect(audioManager.stopSfx).toHaveBeenCalled()
})
