import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from './button'
import { audioManager } from '@/game/audio/AudioManager'
vi.mock('@/game/audio/AudioManager', () => ({ audioManager: { playSfx: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

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


it('plays once for a button without a handler and for an asChild link', () => {
  const handler = vi.fn()
  const { getByRole } = render(<><Button>Plain</Button><Button asChild sfx="ui_start"><a href="/run" onClick={(e) => { e.preventDefault(); handler() }}>Start</a></Button></>)
  fireEvent.click(getByRole('button', { name: 'Plain' }))
  fireEvent.click(getByRole('link', { name: 'Start' }))
  expect(handler).toHaveBeenCalledOnce()
  expect(vi.mocked(audioManager.playSfx).mock.calls).toEqual([['ui_click'], ['ui_start']])
})
it('suppresses disabled and opted-out audio', () => {
  const childClick = vi.fn()
  const { getByRole } = render(<><Button disabled>Disabled</Button><Button sfx={false}>Silent</Button><Button asChild disabled><a href="/run" onClick={childClick}>Disabled link</a></Button></>)
  fireEvent.click(getByRole('button', { name: 'Disabled' }))
  fireEvent.click(getByRole('button', { name: 'Silent' }))
  fireEvent.click(getByRole('link'))
  expect(audioManager.playSfx).not.toHaveBeenCalled()
  expect(childClick).not.toHaveBeenCalled()
})
