import { describe, expect, it } from 'vitest'

import { getResourceIconUrl } from '@/shared/lib/resources'

describe('resources icons', () => {
  it('returns icon url for coins/iron/crystals', () => {
    expect(getResourceIconUrl('coins')).toMatch(/\.png$/)
    expect(getResourceIconUrl('iron')).toMatch(/\.png$/)
    expect(getResourceIconUrl('crystals')).toMatch(/\.png$/)
  })
})
