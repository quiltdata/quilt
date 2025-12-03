import '@testing-library/jest-dom'

// Make Jest globals available for Vitest (for Jest compatibility)
import { vi } from 'vitest'

// Make jest functions available globally for compatibility
;(globalThis as any).jest = {
  fn: vi.fn,
  mock: vi.mock,
  unmock: vi.unmock,
  clearAllMocks: vi.clearAllMocks,
  resetAllMocks: vi.resetAllMocks,
  restoreAllMocks: vi.restoreAllMocks,
  spyOn: vi.spyOn,
  useFakeTimers: vi.useFakeTimers,
  useRealTimers: vi.useRealTimers,
}

// Polyfills required for jsdom environment
// (Ported from setup-jest.ts)

// TextEncoder/TextDecoder for jsdom
;(globalThis as any).TextEncoder = require('util').TextEncoder
;(globalThis as any).TextDecoder = require('util').TextDecoder

// Crypto API for jsdom (used for crypto.subtle.digest)
Object.defineProperty(globalThis, 'crypto', {
  value: new (require('@peculiar/webcrypto').Crypto)(),
})

// Blob/File API support (used for (new File(...)).arrayBuffer())
require('blob-polyfill')