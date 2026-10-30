import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type MeResponse = {
  id: string
  username: string | null
  createdAt: string
}

export type CurrenciesResponse = {
  coins: number
  donateCoins: number
  ore: number
  crystal: number
}

export type ProgressionResponse = {
  loadout: { selectedWeaponId: string }
  ownedWeaponIds: string[]
  upgrades: unknown[]
}

export function getMe() {
  return requestJson<MeResponse>({ method: 'GET', url: endpoints.me() })
}

export function getCurrencies() {
  return requestJson<CurrenciesResponse>({ method: 'GET', url: endpoints.meCurrencies() })
}

export function getProgression() {
  return requestJson<ProgressionResponse>({ method: 'GET', url: endpoints.meProgression() })
}

