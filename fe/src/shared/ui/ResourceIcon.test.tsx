import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResourceIcon } from '@/shared/ui/ResourceIcon'

describe('ResourceIcon', () => {
  it('renders an img with alt', () => {
    render(<ResourceIcon id="iron" />)
    expect(screen.getByRole('img', { name: /iron/i })).toBeInTheDocument()
  })
})

