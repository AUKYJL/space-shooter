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
const started = { runId: 'run-1', seed: 1, scoringConfigVersion: 7, snapshot: { weaponId: 'basic_laser', damage: 1, fireRate: 2, maxHp: 5, scoringConfig: config, gameplayConfig: GAMEPLAY_CONFIG, weaponTuning: WEAPON_TUNING } }
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
  it('rejects a start without its server snapshot instead of falling back to GET config', async () => {
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

  it.each([false, true])('pins the exact start snapshot and clones it (409 retry: %s)', async (retry) => {
    const snapshotConfig = { ...config, version: 7, stageBonus: 777 }
    const snapshotGameplay = structuredClone(GAMEPLAY_CONFIG)
    snapshotGameplay.player.maxHp = 333
    if (retry) {
      vi.mocked(getRunConfig).mockResolvedValueOnce(config).mockResolvedValueOnce({ ...config, version: 7 })
      vi.mocked(startRun).mockRejectedValueOnce(new ApiError('changed', 409, null))
    }
    vi.mocked(startRun).mockResolvedValueOnce({ ...started, scoringConfigVersion: snapshotConfig.version,
      snapshot: { ...started.snapshot, scoringConfig: snapshotConfig, gameplayConfig: snapshotGameplay } })
    const { wrapper, client } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
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
  it('loads GET config and reuses it for a direct start', async () => {
    const { wrapper } = setup()
    const query = renderHook(() => useRunConfigQuery(), { wrapper })
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true))
    const mutation = renderHook(() => useStartRunMutation(), { wrapper })
    let response
    await act(async () => { response = await mutation.result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    expect(startRun).toHaveBeenCalledWith({ weaponId: 'basic_laser', scoringConfigVersion: 7 })
    expect(getRunConfig).toHaveBeenCalledTimes(1)
    expect(response).toEqual({ ...started, scoringConfig: config })
  })
  it('fails without starting if GET fails and allows retry', async () => {
    vi.mocked(getRunConfig).mockRejectedValueOnce(new Error('offline'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ weaponId: 'basic_laser' })).rejects.toThrow('offline') })
    expect(startRun).not.toHaveBeenCalled()
    await act(async () => { await result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    expect(startRun).toHaveBeenCalledTimes(1)
  })
  it('refetches on 409 and retries exactly once with the new version', async () => {
    const updated = { ...config, version: 7, stageBonus: 200, enemyPoints: { sentryTurret: 100, shieldDrone: 50, mineLayer: 150 },
      enemies: structuredClone(RUN_CONFIG.enemies!) }
    vi.mocked(getRunConfig).mockResolvedValueOnce(config).mockResolvedValueOnce(updated)
    vi.mocked(startRun).mockRejectedValueOnce(new ApiError('changed', 409, null))
      .mockResolvedValueOnce({ ...started, scoringConfigVersion: 7, snapshot: { ...started.snapshot, scoringConfig: updated } })
    const { wrapper, client } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await result.current.mutateAsync({ weaponId: 'basic_laser' }) })
    expect(startRun).toHaveBeenLastCalledWith({ weaponId: 'basic_laser', scoringConfigVersion: 7 })
    expect(startRun).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const pinned = result.current.data?.scoringConfig
    client.setQueryData(qk.runConfig(), { ...config, version: 3 })
    expect(pinned).toEqual(updated)
    updated.enemyPoints.sentryTurret = 999
    updated.enemies.sentryTurret = { ...updated.enemies.sentryTurret, spawnEveryMs: 1 }
    expect(pinned?.enemyPoints?.sentryTurret).toBe(100)
    expect(pinned?.enemies?.sentryTurret.spawnEveryMs).toBe(15000)
  })
  it('surfaces a second conflict without looping', async () => {
    vi.mocked(startRun).mockRejectedValue(new ApiError('changed', 409, null))
    const { wrapper } = setup()
    const { result } = renderHook(() => useStartRunMutation(), { wrapper })
    await act(async () => { await expect(result.current.mutateAsync({ weaponId: 'basic_laser' })).rejects.toThrow('changed') })
    expect(startRun).toHaveBeenCalledTimes(2)
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
