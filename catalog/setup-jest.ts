// It's required for jsdom
;(window as any).TextEncoder = require('util').TextEncoder
;(window as any).TextDecoder = require('util').TextDecoder

// Used for `crypto.subtle.digest(...)`
Object.defineProperty(globalThis, 'crypto', {
  value: new (require('@peculiar/webcrypto').Crypto)(),
})

// Used for `(new File(...)).arrayBuffer()`
require('blob-polyfill')
