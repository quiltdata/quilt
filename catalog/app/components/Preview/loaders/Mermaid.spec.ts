import { describe, expect, it, vi } from 'vitest'

import { detect } from './Mermaid'

vi.mock('constants/config', () => ({
  default: {
    apiGatewayEndpoint: '',
  },
}))

describe('components/Preview/loaders/Mermaid', () => {
  describe('detect', () => {
    it('detects the mermaid extensions', () => {
      expect(detect('graph.mmd')).toBe(true)
      expect(detect('graph.mermaid')).toBe(true)
    })

    it('is case-insensitive and path-independent', () => {
      expect(detect('a/b/Graph.MMD')).toBe(true)
    })

    it('does not claim files handled by other loaders', () => {
      expect(detect('README.md')).toBe(false)
      expect(detect('notes.txt')).toBe(false)
      expect(detect('spec.json')).toBe(false)
    })

    it('requires the extension rather than a substring match', () => {
      expect(detect('mermaid')).toBe(false)
      expect(detect('mermaid.json')).toBe(false)
      expect(detect('graph.mmd.gz')).toBe(false)
    })
  })
})
