import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LoadingScreen } from './LoadingScreen'
afterEach(cleanup)
it('renders measured progress and an indeterminate initialization stage', () => {
  const { rerender } = render(<LoadingScreen label="Loading game" progress={0.42} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  expect(screen.getByText('42%')).toBeInTheDocument()
  rerender(<LoadingScreen label="Preparing game" />)
  expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
})
it('renders errors and retries explicitly', () => {
  const retry = vi.fn()
  render(<LoadingScreen label="Loading game" error="offline" onRetry={retry} />)
  expect(screen.getByRole('alert')).toHaveTextContent('offline')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
})
