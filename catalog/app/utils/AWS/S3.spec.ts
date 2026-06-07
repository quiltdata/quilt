import { describe, it, expect, vi } from 'vitest'

// S3.jsx imports constants/config (which reads window.QUILT_CATALOG_CONFIG at
// module load); stub it so the module imports cleanly under vitest.
vi.mock('constants/config', () => ({ default: {} }))

import { resolveProxyUrl } from './S3'

describe('utils/AWS/S3', () => {
  describe('resolveProxyUrl', () => {
    it('resolves a relative proxy path against the page origin (LOCAL mode)', () => {
      expect(resolveProxyUrl('/__s3proxy', 'http://127.0.0.1:3000')).toBe(
        'http://127.0.0.1:3000/__s3proxy',
      )
    })

    it('leaves an absolute http(s) proxy URL untouched (production)', () => {
      const abs = 'https://open-proxy.quiltdata.com'
      expect(resolveProxyUrl(abs, 'http://127.0.0.1:3000')).toBe(abs)
      expect(resolveProxyUrl('http://example.com/proxy', 'http://x')).toBe(
        'http://example.com/proxy',
      )
    })

    it('defaults to window.location.origin when no origin is passed', () => {
      // jsdom origin is configured as https://quilt-test in vitest.config
      expect(resolveProxyUrl('/__s3proxy')).toBe(`${window.location.origin}/__s3proxy`)
    })
  })
})
