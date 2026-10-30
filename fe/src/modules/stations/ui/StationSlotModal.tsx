import { useMemo } from 'react'

import { ApiError } from '@/shared/api/client'
import { useCurrenciesQuery } from '@/modules/profile/api/profileQueries'
import {
  useAssignStationMutation,
  useStationSlotsQuery,
  useStationsCatalogQuery,
  useStationsUnlocksQuery,
  useUnlockStationMutation,
} from '@/modules/stations/api/stationsQueries'
import { Button } from '@/shared/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'
import { ResourceAmount } from '@/shared/ui/ResourceAmount'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'

export function StationSlotModal(props: { open: boolean; slotIndex: number | null; onClose: () => void }) {
  const currenciesQuery = useCurrenciesQuery()
  const catalogQuery = useStationsCatalogQuery()
  const unlocksQuery = useStationsUnlocksQuery()
  const slotsQuery = useStationSlotsQuery()
  const unlockStationMutation = useUnlockStationMutation()
  const assignStationMutation = useAssignStationMutation()

  const coins = currenciesQuery.data?.coins ?? 0
  const slotIndex = props.slotIndex
  const slot = slotIndex != null ? (slotsQuery.data ?? [])[slotIndex] ?? null : null

  const unlockedStationIds = useMemo(() => {
    return new Set((unlocksQuery.data ?? []).map((u) => u.stationId))
  }, [unlocksQuery.data])

  const assignedStationIds = useMemo(() => {
    return new Set((slotsQuery.data ?? []).map((s) => s.assignedStationId).filter(Boolean) as string[])
  }, [slotsQuery.data])

  const errorMessage = useMemo(() => {
    const err =
      currenciesQuery.error ??
      catalogQuery.error ??
      unlocksQuery.error ??
      slotsQuery.error ??
      unlockStationMutation.error ??
      assignStationMutation.error
    if (!err) return null
    if (err instanceof ApiError) return err.message
    if (err instanceof Error) return err.message
    return 'Unknown error'
  }, [
    assignStationMutation.error,
    catalogQuery.error,
    currenciesQuery.error,
    slotsQuery.error,
    unlockStationMutation.error,
    unlocksQuery.error,
  ])

  return (
    <Drawer open={props.open} onOpenChange={(v) => (!v ? props.onClose() : undefined)}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>Choose station</DrawerTitle>
          <DrawerDescription>Unlock a station, then assign it to this slot.</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-2 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon id="coins" size={12} />
            <span>Coins:</span>
          </span>{' '}
          <span className="font-semibold text-accent-gold">{coins.toLocaleString()}</span>
          {errorMessage ? <span className="ml-2 text-red-400">{errorMessage}</span> : null}
        </div>

        <div className="flex flex-col gap-2 px-4 pb-4">
          {(catalogQuery.data ?? []).map((station) => {
            const unlocked = unlockedStationIds.has(station.id)
            const unlockCost =
              station.unlockCostJson && typeof station.unlockCostJson === 'object'
                ? (station.unlockCostJson as { coins?: number }).coins ?? station.unlockCostJson
                : station.unlockCostJson

            const assignedElsewhere =
              assignedStationIds.has(station.id) && (!slot?.assignedStationId || slot.assignedStationId !== station.id)

            const canUnlock = !unlocked && typeof unlockCost === 'number' && coins >= unlockCost
            const canAssign = unlocked && slot && !assignedElsewhere && !assignStationMutation.isPending

            return (
              <div key={station.id} className="rounded-xl border border-white/10 bg-bg-secondary px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <div className="text-sm font-semibold">{station.name}</div>
                    <div className="mt-1 text-xs text-text-secondary">
                      Generates <span className="font-semibold text-text-primary">{station.resourceType}</span> ·{' '}
                      <span className="font-semibold text-text-primary">{station.baseAmountPerCycle}</span> per{' '}
                      <span className="font-semibold text-text-primary">{station.cycleDurationHours}h</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
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
                      <span>per cycle</span>
                    </div>

                    {!unlocked ? (
                      <div className="mt-2 text-xs text-text-secondary">
                        Cost:{' '}
                        <span className="font-semibold text-accent-gold">
                          {typeof unlockCost === 'number' ? unlockCost.toLocaleString() : 'See backend'}
                        </span>
                      </div>
                    ) : assignedElsewhere ? (
                      <div className="mt-2 text-xs text-text-secondary">Already assigned to another slot</div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {!unlocked ? (
                      <Button
                        className="h-10 px-4 font-semibold"
                        disabled={!canUnlock || unlockStationMutation.isPending}
                        onClick={() => unlockStationMutation.mutate({ stationId: station.id })}
                        variant={canUnlock ? 'default' : 'secondary'}
                      >
                        {unlockStationMutation.isPending ? 'Unlocking…' : 'Unlock'}
                      </Button>
                    ) : (
                      <DrawerClose asChild>
                        <Button
                          className="h-10 px-4 font-semibold"
                          disabled={!canAssign}
                          onClick={() => {
                            if (!slot) return
                            assignStationMutation.mutate({ slotId: slot.id, stationId: station.id })
                          }}
                          variant={canAssign ? 'default' : 'secondary'}
                        >
                          Assign
                        </Button>
                      </DrawerClose>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="h-12 font-semibold" onClick={props.onClose}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

