import { useMemo } from 'react'

import { ApiError } from '@/shared/api/client'
import { useCurrenciesQuery } from '@/modules/profile/api/profileQueries'
import { useBuyUpgradeMutation, useUpgradesQuery } from '@/modules/upgrades/api/upgradesQueries'
import { Button } from '@/shared/ui/button'

export function UpgradesPage() {
  const currenciesQuery = useCurrenciesQuery()
  const upgradesQuery = useUpgradesQuery()
  const buyUpgradeMutation = useBuyUpgradeMutation()

  const coins = currenciesQuery.data?.coins ?? 0
  const upgrades = upgradesQuery.data ?? []

  const errorMessage = useMemo(() => {
    const err = currenciesQuery.error ?? upgradesQuery.error ?? buyUpgradeMutation.error
    if (!err) return null
    if (err instanceof ApiError) return err.message
    if (err instanceof Error) return err.message
    return 'Unknown error'
  }, [buyUpgradeMutation.error, currenciesQuery.error, upgradesQuery.error])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-2xl font-semibold text-neon-cyan">Upgrades</div>
        <div className="mt-1 text-xs text-text-secondary">Spend coins to unlock account upgrades.</div>
        {errorMessage ? <div className="mt-2 text-xs text-red-400">{errorMessage}</div> : null}
      </div>

      <div className="rounded-xl bg-bg-secondary px-4 py-3">
        <div className="text-xs text-text-secondary">Coins</div>
        <div className="text-sm font-semibold text-accent-gold">{coins.toLocaleString()}</div>
      </div>

      <div className="flex flex-col gap-3">
        {upgrades.map((u) => {
          const canBuy = !u.purchased && coins >= u.costCoins && !buyUpgradeMutation.isPending
          return (
            <div key={u.id} className="rounded-xl bg-bg-secondary px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <div className="text-sm font-semibold">{u.id}</div>
                  <div className="mt-1 text-xs text-text-secondary">
                    Type: <span className="font-semibold text-text-primary">{u.type}</span> · Level{' '}
                    <span className="font-semibold text-text-primary">{u.level}</span>
                  </div>
                </div>
                <div
                  className={[
                    'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                    u.purchased ? 'bg-neon-cyan text-bg-primary' : 'bg-bg-tertiary text-neon-purple',
                  ].join(' ')}
                >
                  {u.purchased ? 'Purchased' : 'Available'}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-text-secondary">
                  {u.purchased ? (
                    'Already purchased'
                  ) : (
                    <>
                      Cost: <span className="font-semibold text-accent-gold">{u.costCoins.toLocaleString()}</span>
                    </>
                  )}
                </div>
                <Button
                  className="h-10 px-4 font-semibold"
                  disabled={!canBuy}
                  onClick={() => buyUpgradeMutation.mutate({ upgradeId: u.id })}
                  variant={canBuy ? 'default' : 'secondary'}
                >
                  {u.purchased ? 'Owned' : buyUpgradeMutation.isPending ? 'Buying…' : 'Buy'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
