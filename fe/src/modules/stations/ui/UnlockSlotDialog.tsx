import { useMemo } from 'react'

import { ApiError } from '@/shared/api/client'
import { useCurrenciesQuery } from '@/modules/profile/api/profileQueries'
import { useStationSlotsQuery, useUnlockSlotMutation } from '@/modules/stations/api/stationsQueries'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'

interface Props {
  open: boolean
  slotIndex: number | null
  onClose: () => void
}

export const UnlockSlotDialog = ({ open, slotIndex, onClose }: Props) => {
  const currenciesQuery = useCurrenciesQuery()
  const slotsQuery = useStationSlotsQuery()
  const unlockSlotMutation = useUnlockSlotMutation()

  const coins = currenciesQuery.data?.coins ?? 0
  const unlockedSlotCount = (slotsQuery.data ?? []).length

  const isAtCap = unlockedSlotCount >= 3
  const isNextSlot = slotIndex != null && slotIndex === unlockedSlotCount
  const canUnlock = Boolean(isNextSlot && !isAtCap && !unlockSlotMutation.isPending)
  const slotNumber = slotIndex != null ? slotIndex + 1 : null

  const errorMessage = useMemo(() => {
    const err = unlockSlotMutation.error
    if (!err) return null
    if (err instanceof ApiError) return err.message
    if (err instanceof Error) return err.message
    return 'Failed to unlock slot'
  }, [unlockSlotMutation.error])

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{slotNumber != null ? `Unlock Slot ${slotNumber}` : 'Unlock Slot'}</DialogTitle>
          <DialogDescription>
            {isAtCap ? (
              'All station slots are already unlocked.'
            ) : !isNextSlot ? (
              `Unlock Slot ${unlockedSlotCount + 1} first.`
            ) : (
              'Price is calculated on the server.'
            )}
            {errorMessage ? <span className="ml-2 text-red-400">{errorMessage}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pt-3 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1">
            <ResourceIcon id="coins" size={12} />
            <span>Coins:</span>
          </span>{' '}
          <span className="font-semibold text-accent-gold">{coins.toLocaleString()}</span>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary" className="h-12 font-semibold" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              className="h-12 font-semibold"
              disabled={!canUnlock}
              onClick={() => {
                if (!canUnlock) return
                unlockSlotMutation.mutate(undefined, { onSuccess: onClose })
              }}
              variant={canUnlock ? 'default' : 'secondary'}
            >
              {unlockSlotMutation.isPending ? 'Unlocking…' : 'Unlock'}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

