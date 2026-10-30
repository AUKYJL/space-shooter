import { Link } from '@tanstack/react-router'
import { Button } from '@/shared/ui/button'
import { useAppStore } from '@/shared/store/appStore'
import { useEffect } from 'react'
import { WEAPON_CATALOG } from '@/shared/lib/weapons'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'
import { useCurrenciesQuery, useMeQuery, useProgressionQuery } from '@/modules/profile/api/profileQueries'

export function MainMenuPage() {
  const selectedWeaponId = useAppStore((s) => s.selectedWeaponId)
  const setSelectedWeaponId = useAppStore((s) => s.setSelectedWeaponId)
  const profile = useMeQuery()
  const currencies = useCurrenciesQuery()
  const progression = useProgressionQuery()
  const selectedWeaponTitle =
    WEAPON_CATALOG.find((w) => w.id === selectedWeaponId)?.title ?? selectedWeaponId

  const coins = currencies.data?.coins ?? 0
  const crystals = currencies.data?.crystal ?? 0

  // Keep the local UI selection in sync with backend-selected weapon (meta state only).
  useEffect(() => {
    const id = progression.data?.loadout?.selectedWeaponId
    if (!id) return
    if (id === selectedWeaponId) return
    setSelectedWeaponId(id)
  }, [progression.data?.loadout?.selectedWeaponId, selectedWeaponId, setSelectedWeaponId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 pt-1">
        <div className="size-12 rounded-full bg-bg-secondary" aria-hidden="true" />
        <div className="flex flex-col">
          <div className="text-sm font-semibold leading-5">Commander</div>
          <div className="text-xs text-text-secondary">Level 12</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-bg-secondary px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <ResourceIcon id="coins" size={14} />
            <span>Coins</span>
          </div>
          <div className="text-sm font-semibold text-accent-gold">
            {currencies.isLoading ? '—' : coins.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-bg-secondary px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <ResourceIcon id="crystals" size={14} />
            <span>Crystals</span>
          </div>
          <div className="text-sm font-semibold text-neon-cyan">
            {currencies.isLoading ? '—' : crystals.toLocaleString()}
          </div>
        </div>
      </div>

      <Button asChild size="xl" className="h-14 text-base font-semibold">
        <Link to="/run">Start Run</Link>
      </Button>

      <Button asChild variant="secondary" className="h-12 font-semibold">
        <Link to="/loadout">Loadout: {selectedWeaponTitle}</Link>
      </Button>

      <div className="rounded-xl bg-bg-secondary px-4 py-3">
        <div className="text-xs font-semibold text-neon-cyan">Current Run</div>
        <div className="mt-1 text-xs text-text-secondary">
          Eliminate enemies and collect resources. Best score: {profile.data && !profile.isError ? profile.data.bestScore.toLocaleString() : '—'}
        </div>
      </div>
    </div>
  )
}
