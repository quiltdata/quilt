import '@testing-library/jest-dom'



  // TextEncoder/TextDecoder for jsdom
  ; (globalThis as any).TextEncoder = require('util').TextEncoder
  ; (globalThis as any).TextDecoder = require('util').TextDecoder

// Crypto API for jsdom (used for crypto.subtle.digest)
Object.defineProperty(globalThis, 'crypto', {
  value: new (require('@peculiar/webcrypto').Crypto)(),
})

// Blob/File API support (used for (new File(...)).arrayBuffer())
require('blob-polyfill')
