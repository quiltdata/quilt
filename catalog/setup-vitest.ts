import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { cleanup as cleanupHooks } from '@testing-library/react-hooks'

// Unmount components rendered by @testing-library/react after each test.
// `globals` is off in vitest.config.ts, so RTL's own auto-cleanup (which only
// registers when `afterEach` is a global) never runs — leaving components
// mounted across tests. Their queued passive effects can then flush after the
// jsdom environment is torn down, throwing "The `document` global was defined
// when React was initialized, but is not defined anymore" as an unhandled
// error that fails the run even when every test passed.
afterEach(cleanup)
// Same problem for hooks rendered via @testing-library/react-hooks: with
// `globals` off its auto-cleanup never registers either, so hook roots that
// kick off async work (e.g. Athena/model/requests' fetch-then-setState) stay
// mounted and flush a deferred React commit after the jsdom env is torn down —
// "window is not defined" in react-dom's getActiveElementDeep, failing the run
// even when every test passed. Unmount those roots too.
afterEach(cleanupHooks)

// Suppress noisy AWS SDK v2 deprecation warnings during tests
const originalEmitWarning = process.emitWarning
const emitWarning = (...[warning, ...rest]: Parameters<typeof process.emitWarning>) => {
  // Suppress AWS SDK v2 deprecation warnings
  if (typeof warning === 'string' && warning.includes('AWS SDK for JavaScript (v2)')) {
    return
  }
  return originalEmitWarning.call(process, warning, ...rest)
}

process.emitWarning = emitWarning as typeof process.emitWarning

// TextEncoder/TextDecoder for jsdom
;(globalThis as any).TextEncoder = require('util').TextEncoder
;(globalThis as any).TextDecoder = require('util').TextDecoder

// Crypto API for jsdom (used for crypto.subtle.digest)
Object.defineProperty(globalThis, 'crypto', {
  value: new (require('@peculiar/webcrypto').Crypto)(),
})

// Blob/File API support (used for (new File(...)).arrayBuffer())
require('blob-polyfill')
