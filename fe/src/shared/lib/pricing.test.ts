import { describe, expect, it } from 'vitest'

import { getNextStationSlotCost, getStationPurchaseCost } from '@/shared/lib/pricing'

describe('station slot pricing', () => {
  it('cost increases per slot', () => {
    expect(getNextStationSlotCost(0)).toBeGreaterThan(0)
    expect(getNextStationSlotCost(1)).toBeGreaterThan(getNextStationSlotCost(0))
    expect(getNextStationSlotCost(2)).toBeGreaterThan(getNextStationSlotCost(1))
  })
})

describe('station purchase pricing', () => {
  it('returns positive fixed cost for known station', () => {
    expect(getStationPurchaseCost('coin_station')).toBeGreaterThan(0)
  })
})

