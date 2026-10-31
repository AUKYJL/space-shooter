import { Link } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'

import { WEAPON_CATALOG } from '@/shared/lib/weapons'
import { useRunConfigQuery } from '@/modules/runs/api/runsQueries'
import { useAppStore } from '@/shared/store/appStore'
import { Button } from '@/shared/ui/button'
import { ResourceIcon } from '@/shared/ui/ResourceIcon'
import { useCurrenciesQuery, useProgressionQuery } from '@/modules/profile/api/profileQueries'
import { useLoadoutQuery, usePatchWeaponMutation } from '@/modules/loadout/api/loadoutQueries'

export function WeaponSelectPage() {
  const selectedWeaponId = useAppStore((s) => s.selectedWeaponId)
  const setSelectedWeaponId = useAppStore((s) => s.setSelectedWeaponId)
  const config = useRunConfigQuery()
  const currencies = useCurrenciesQuery()
  const progression = useProgressionQuery()
  const loadout = useLoadoutQuery()
  const patchWeapon = usePatchWeaponMutation()

  const ownedWeaponIds = progression.data?.ownedWeaponIds ?? []

  const loading = config.isLoading || currencies.isLoading || progression.isLoading || loadout.isLoading
  const selectedFromBackend = useMemo(
    () => loadout.data?.selectedWeaponId ?? progression.data?.loadout?.selectedWeaponId ?? null,
    [loadout.data?.selectedWeaponId, progression.data?.loadout?.selectedWeaponId],
  )

  useEffect(() => {
    if (!selectedFromBackend) return
    if (selectedFromBackend === selectedWeaponId) return
    setSelectedWeaponId(selectedFromBackend)
  }, [selectedFromBackend, selectedWeaponId, setSelectedWeaponId])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-2xl font-semibold text-neon-cyan">Loadout</div>
        <div className="mt-1 text-xs text-text-secondary">Choose a weapon before starting a run.</div>
      </div>

      {config.isError ? <div role="alert">Failed to load weapon configuration</div> : null}
      <div className="flex flex-col gap-3">
        {loading ? <div className="text-xs text-text-secondary">Loading loadout…</div> : null}
        {WEAPON_CATALOG.map((w) => {
          const active = w.id === selectedWeaponId
          const owned = ownedWeaponIds.includes(w.id)
          const cost = config.data?.gameplay.weapons.purchaseCosts[w.id]
          const baseClassName = [
            'w-full rounded-xl border bg-bg-secondary px-4 py-4 text-left transition-colors',
            active ? 'border-neon-cyan/60 shadow-[0_0_32px_rgba(0,212,255,0.12)]' : 'border-white/10',
          ].join(' ')

          const content = (
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <div className="text-sm font-semibold">{w.title}</div>
                <div className="mt-1 text-xs text-text-secondary">{w.description}</div>
                {!owned && cost != null ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-xs text-text-secondary">
                      Locked • <span className="font-semibold text-accent-gold">{cost.toLocaleString()}</span>{' '}
                      <ResourceIcon id="coins" size={14} className="-mt-px opacity-90" />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled
                      onClick={() => {}}
                    >
                      Buy (soon)
                    </Button>
                  </div>
                ) : null}
              </div>
              <div
                className={[
                  'mt-0.5 size-4 rounded-full border',
                  active && owned ? 'border-neon-cyan bg-neon-cyan' : 'border-white/20 bg-transparent',
                ].join(' ')}
                aria-hidden="true"
              />
            </div>
          )

          return (
            owned ? (
              <button
                key={w.id}
                type="button"
                disabled={patchWeapon.isPending}
                onClick={() => {
                  setSelectedWeaponId(w.id)
                  patchWeapon.mutate({ weaponId: w.id })
                }}
                className={baseClassName}
              >
                {content}
              </button>
            ) : (
              <div key={w.id} className={[baseClassName, 'opacity-90'].join(' ')}>
                {content}
              </div>
            )
          )
        })}
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3">
        <Button asChild className="h-12 font-semibold" variant="secondary">
          <Link to="/">Back</Link>
        </Button>
      </div>
    </div>
  )
}
