import { RUN_CONFIG, GAMEPLAY_CONFIG, WEAPON_TUNING } from '@/test/runConfig'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { qk } from '@/shared/api/queryKeys'
import { finishRun, getRunConfig, startRun, type FinishRunRequest } from './runsApi'
import { useFinishRunMutation, useRunConfigQuery, useStartRunMutation } from './runsQueries'

vi.mock('./runsApi', () => ({ getRunConfig: vi.fn(), startRun: vi.fn(), finishRun: vi.fn() }))
const config = structuredClone(RUN_CONFIG)
const started = { runId: 'run-1', seed: 1, snapshot: { weaponId: 'basic_laser', damage: 1, fireRate: 2, maxHp: 5, scoringConfig: config, gameplayConfig: GAMEPLAY_CONFIG, weaponTuning: WEAPON_TUNING } }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getRunConfig).mockResolvedValue(config)
  vi.mocked(startRun).mockResolvedValue(started)
})
afterEach(cleanup)

describe('run config and start', () => {
  it('rejects a start without its server snapshot', async () => {
    const response = JSON.parse(JSON.stringify(started))
    delete response.snapshot.scoringConfig
    vi.mocked(startRun).mockResolvedValueOnce(response)
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ weaponId: 'basic_laser' })).rejects.toThrow('Invalid run configuration: scoring')
    })
    expect(startRun).toHaveBeenCalledTimes(1)
  })

  it('pins the exact start snapshot and clones it independently of cached config', async () => {
    const snapshotConfig = { ...config, stageBonus: 777 }
    const snapshotGameplay = structuredClone(GAMEPLAY_CONFIG)
    snapshotGameplay.player.maxHp = 333
    vi.mocked(startRun).mockResolvedValueOnce({ ...started,
      snapshot: { ...started.snapshot, scoringConfig: snapshotConfig, gameplayConfig: snapshotGameplay } })
    const { wrapper, client } = setup()
    client.setQueryData(qk.runConfig(), config)
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    expect(startRun).toHaveBeenCalledWith({ weaponId: 'basic_laser' })
    expect(getRunConfig).not.toHaveBeenCalled()
    expect(result.current.data?.scoringConfig.stageBonus).toBe(777)
    expect(result.current.data?.snapshot.gameplayConfig.player.maxHp).toBe(333)
    snapshotGameplay.player.maxHp = 999
    snapshotConfig.stageBonus = 999
    client.setQueryData(qk.runConfig(), { ...config, stageBonus: 888 })
    expect(result.current.data?.scoringConfig.stageBonus).toBe(777)
    expect(result.current.data?.snapshot.gameplayConfig.player.maxHp).toBe(333)
  })

  it('does not request config before authentication', () => {
    const { wrapper } = setup()
    renderHook(() => useRunConfigQuery(false), { wrapper })
    expect(getRunConfig).not.toHaveBeenCalled()
  })
  it('loads GET config independently of starting a run', async () => {
    const { wrapper } = setup()
    const query = renderHook(() => useRunConfigQuery(), { wrapper })
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true))
    const mutation = renderHook(() => useStartRunMutation(), { wrapper })
    let response
    await act(async () => { response = await mutation.result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    expect(startRun).toHaveBeenCalledWith({ weaponId: 'basic_laser' })
    expect(getRunConfig).toHaveBeenCalledTimes(1)
    expect(response).toEqual({ ...started, scoringConfig: config })
  })
  it('starts without a GET config request', async () => {
    vi.mocked(getRunConfig).mockRejectedValue(new Error('offline'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    expect(getRunConfig).not.toHaveBeenCalled()
    expect(startRun).toHaveBeenCalledTimes(1)
  })
  it('surfaces start errors without automatic retries', async () => {
    vi.mocked(startRun).mockRejectedValue(new ApiError('conflict', 409, null))
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ weaponId: 'basic_laser' })).rejects.toThrow('conflict') })
    expect(startRun).toHaveBeenCalledTimes(1)
    expect(getRunConfig).not.toHaveBeenCalled()
  })
})

describe('finish cache', () => {
  it('keeps the highest cached record and invalidates server data', async () => {
    const { wrapper, client } = setup()
    client.setQueryData(qk.me(), { id: 'user', username: null, createdAt: '', bestScore: 1000 })
    client.setQueryData(qk.currencies(), { coins: 0 })
    client.setQueryData(qk.runsHistory(), [])
    vi.mocked(finishRun).mockResolvedValue({ accepted: true, score: 110, bestScore: 110,
      grantedRewards: { coins: 0, resources: { ore: 0, crystal: 0 } } })
    const { result } = renderHook(() => useFinishRunMutation(), { wrapper })
    await act(async () => { await result.current.mutateAsync({} as FinishRunRequest) })
    expect(client.getQueryData(qk.me())).toMatchObject({ bestScore: 1000 })
    expect(client.getQueryState(qk.me())?.isInvalidated).toBe(true)
    expect(client.getQueryState(qk.currencies())?.isInvalidated).toBe(true)
    expect(client.getQueryState(qk.runsHistory())?.isInvalidated).toBe(true)
  })
})
