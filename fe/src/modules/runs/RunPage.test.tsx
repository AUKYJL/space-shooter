import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventBus } from '@/game/core/EventBus'
import type { RunBridgeEventMap, RunHudState, RunSummary } from '@/game/ui-bridge/gameToReact'
import { useAppStore } from '@/shared/store/appStore'
import { RunPage } from './RunPage'
import { finishRun, getRunConfig, startRun, type ScoringConfig, type StartRunResponse } from './api/runsApi'

const bridge = vi.hoisted(() => ({ events: null as EventBus<RunBridgeEventMap> | null, runId: '' }))
vi.mock('./api/runsApi', () => ({ getRunConfig: vi.fn(), startRun: vi.fn(), finishRun: vi.fn() }))
vi.mock('./GameCanvas', () => ({ GameCanvas: (props: { events: EventBus<RunBridgeEventMap>; init: StartRunResponse & { scoringConfig: ScoringConfig } }) => {
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

const config = { version: 1, asteroidPoints: { normal: 10, fast: 20, big: 30, armored: 50 }, stageBonus: 100 }
const initial = { runId: 'one', seed: 1, scoringConfigVersion: 1, snapshot: { weaponId: 'basic_laser', damage: 1, fireRate: 2, maxHp: 5, scoringConfig: config } }
const summary: RunSummary = { score: 110, stageReached: 1, durationMs: 20_000, endedBy: 'death', extractionCount: 0, multiplier: 1,
  collected: { coins: 10, iron: 2, gold: 0, crystal: 1 }, banked: { coins: 0, iron: 0, gold: 0, crystal: 0 },
  enemiesDestroyed: { sentryTurret: 0 },
  destroyed: { normal: 1, fast: 1, big: 1, armored: 1 } }
const result = { accepted: true, score: 110, bestScore: 110, grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } }
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<StrictMode><QueryClientProvider client={client}><RunPage /></QueryClientProvider></StrictMode>)
}
beforeEach(() => {
  vi.resetAllMocks()
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
