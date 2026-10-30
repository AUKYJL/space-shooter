import type { WeaponId } from '@/shared/lib/weapons'
import { requestJson } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export type LoadoutResponse = {
  userId: string
  selectedWeaponId: WeaponId
}

export function getLoadout() {
  return requestJson<LoadoutResponse>({ method: 'GET', url: endpoints.loadout() })
}

export function patchWeapon(body: { weaponId: string }) {
  return requestJson<LoadoutResponse>({ method: 'PATCH', url: endpoints.loadoutWeapon(), data: body })
}

