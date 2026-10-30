import '@testing-library/jest-dom/vitest'

// jsdom doesn't implement canvas; Pixi (and some code paths) may call getContext().
// Provide a minimal stub to avoid noisy "Not implemented" logs during tests.
HTMLCanvasElement.prototype.getContext = (() => ({} as unknown)) as unknown as typeof HTMLCanvasElement.prototype.getContext
