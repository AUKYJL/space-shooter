import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'

import { ApiError } from '@/shared/api/client'
import { useCurrenciesQuery } from '@/modules/profile/api/profileQueries'
import {
  useCollectStationMutation,
  useStartStationMutation,
  useStationSlotsQuery,
  useStationsCatalogQuery,
} from '@/modules/stations/api/stationsQueries'
import type { StationCatalogItem } from '@/modules/stations/api/stationsApi'
import { Button } from '@/shared/ui/button'
import { StationSlotModal, UnlockSlotDialog } from '@/modules/stations/ui'
import { ResourceAmount } from '@/shared/ui/ResourceAmount'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'

export function StationsPage() {
  const currenciesQuery = useCurrenciesQuery()
  const catalogQuery = useStationsCatalogQuery()
  const slotsQuery = useStationSlotsQuery()
  const startStationMutation = useStartStationMutation()
  const collectStationMutation = useCollectStationMutation()

  const coins = currenciesQuery.data?.coins ?? 0
  const slots = slotsQuery.data ?? []
  const unlockedSlotCount = slots.length

  const [now, setNow] = useState(() => Date.now())
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null)
  const [unlockSlotIndex, setUnlockSlotIndex] = useState<number | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const byId = useMemo(() => {
    const map = new Map<string, StationCatalogItem>()
    for (const s of catalogQuery.data ?? []) map.set(s.id, s)
    return map
  }, [catalogQuery.data])

  const errorMessage = useMemo(() => {
    const err =
      currenciesQuery.error ??
      catalogQuery.error ??
      slotsQuery.error ??
      startStationMutation.error ??
      collectStationMutation.error
    if (!err) return null
    if (err instanceof ApiError) return err.message
    if (err instanceof Error) return err.message
    return 'Unknown error'
  }, [
    catalogQuery.error,
    collectStationMutation.error,
    currenciesQuery.error,
    slotsQuery.error,
    startStationMutation.error,
  ])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-2xl font-semibold text-neon-cyan">Stations</div>
        <div className="mt-1 text-xs text-text-secondary">Resource Generation</div>
        {errorMessage ? <div className="mt-2 text-xs text-red-400">{errorMessage}</div> : null}
      </div>

      <div className="rounded-xl bg-bg-secondary px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <ResourceIcon id="coins" size={14} />
              <span>Coins</span>
            </div>
            <div className="text-sm font-semibold text-accent-gold">{coins.toLocaleString()}</div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-xs text-text-secondary">Slots</div>
            <div className="text-sm font-semibold text-text-primary">{unlockedSlotCount}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, idx) => {
          const isUnlocked = idx < unlockedSlotCount
          const slot = slots[idx] ?? null

          if (!isUnlocked) {
            return (
              <button
                key={idx}
                type="button"
                className="relative w-full rounded-xl border border-white/10 bg-bg-secondary px-4 py-4 text-left"
                onClick={() => setUnlockSlotIndex(idx)}
              >
                <div className="text-sm font-semibold">{`Slot ${idx + 1}`}</div>
                <div className="mt-1 text-xs text-text-secondary">
                  {idx === unlockedSlotCount && unlockedSlotCount < 3 ? 'Unlock this slot' : 'Unlock previous slot first'}
                </div>

                <div className="pointer-events-none absolute inset-0 rounded-xl bg-black/35" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-bg-tertiary/60">
                    <Lock className="h-5 w-5 text-text-secondary" />
                  </div>
                </div>
              </button>
            )
          }

          const station = slot?.assignedStationId ? byId.get(slot.assignedStationId) ?? null : null
          const endsAtMs = slot?.endsAt ? Date.parse(slot.endsAt) : null
          const isReady = Boolean(endsAtMs && now >= endsAtMs)
          const remaining = endsAtMs ? Math.max(0, endsAtMs - now) : null
          const isIdle = Boolean(station && !slot?.startedAt && !slot?.endsAt)

          return (
            <div key={idx} className="rounded-xl border border-white/10 bg-bg-secondary px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <div className="text-sm font-semibold">{station ? station.name : `Slot ${idx + 1}`}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {station ? `Generates ${station.resourceType}` : 'Assign a station to start generating.'}
                  </div>
                </div>
                {station ? (
                  <div
                    className={[
                      'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                      isReady ? 'bg-neon-cyan text-bg-primary' : 'bg-bg-tertiary text-neon-purple',
                    ].join(' ')}
                  >
                    {isReady ? 'Ready' : remaining != null ? formatRemaining(remaining) : isIdle ? 'Idle' : 'Running'}
                  </div>
                ) : null}
              </div>

              {station ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <span>+</span>
                      <ResourceAmount
                        id={
                          station.resourceType === 'ore'
                            ? 'iron'
                            : station.resourceType === 'crystal'
                              ? 'crystals'
                              : 'coins'
                        }
                        amount={station.baseAmountPerCycle}
                      />
                    </span>
                    <span>per {station.cycleDurationHours}h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="h-10 px-4 font-semibold"
                      onClick={() => setActiveSlotIndex(idx)}
                    >
                      Manage
                    </Button>
                    <Button
                      className="h-10 px-4 font-semibold"
                      disabled={!slot || collectStationMutation.isPending || !isReady}
                      onClick={() => (slot ? collectStationMutation.mutate({ slotId: slot.id }) : undefined)}
                    >
                      Collect
                    </Button>
                    <Button
                      className="h-10 px-4 font-semibold"
                      disabled={!slot || startStationMutation.isPending || !isIdle}
                      onClick={() => (slot ? startStationMutation.mutate({ slotId: slot.id }) : undefined)}
                      variant="secondary"
                    >
                      Start
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <Button className="h-10 px-4 font-semibold" onClick={() => setActiveSlotIndex(idx)}>
                    Choose Station
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3">
        <Button
          className="h-14 text-base font-semibold"
          disabled={collectStationMutation.isPending}
          onClick={() => {
            const ready = (slotsQuery.data ?? []).filter((s) => s.endsAt && Date.parse(s.endsAt) <= Date.now())
            for (const s of ready) collectStationMutation.mutate({ slotId: s.id })
          }}
        >
          Collect All
        </Button>
        <Button variant="secondary" className="h-12 font-semibold">
          Upgrade Stations
        </Button>
      </div>

      <StationSlotModal open={activeSlotIndex != null} slotIndex={activeSlotIndex} onClose={() => setActiveSlotIndex(null)} />
      <UnlockSlotDialog open={unlockSlotIndex != null} slotIndex={unlockSlotIndex} onClose={() => setUnlockSlotIndex(null)} />
    </div>
  )
}

function formatRemaining(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  const s = seconds % 60
  const minutes = Math.floor(seconds / 60)
  const m = minutes % 60
  const hours = Math.floor(minutes / 60)
  if (hours > 0) return `${hours}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
