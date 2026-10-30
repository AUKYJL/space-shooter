import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type UpgradeItem = {
  id: string
  type: string
  level: number
  costCoins: number
  costResourcesJson: unknown
  effectJson: unknown
  purchasedAt: string | null
  purchased: boolean
}

export function getUpgrades() {
  return requestJson<UpgradeItem[]>({ method: 'GET', url: endpoints.upgrades() })
}

export function buyUpgrade(body: { upgradeId: string }) {
  return requestJson<{ ok: true }>({ method: 'POST', url: endpoints.upgradesBuy(), data: body })
}

