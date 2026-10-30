import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './button'

vi.mock('@/shared/lib/haptics', () => ({
  haptics: { tap: vi.fn() },
}))

describe('Button haptics', () => {
  it('triggers tap haptics on click', async () => {
    const { haptics } = await import('@/shared/lib/haptics')
    const { getByRole } = render(<Button onClick={() => {}}>Tap</Button>)
    fireEvent.click(getByRole('button'))
    expect(haptics.tap).toHaveBeenCalled()
  })
})

