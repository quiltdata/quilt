import { describe, expect, it, vi } from 'vitest'

import { getMetaValue } from './package'

vi.mock('constants/config', () => ({ default: {} }))

describe('containers/Bucket/requests/package', () => {
  describe('getMetaValue', () => {
    const schema = {
      type: 'object',
      required: ['lane'],
      properties: { lane: { type: 'number', default: 1 } },
    }

    it('with keepSet, applies defaults to untouched metadata, as guided validation does', () => {
      expect(getMetaValue(undefined, schema, { keepSet: true })).toEqual({ lane: 1 })
    })

    it('with keepSet and nothing to default, still sends no metadata', () => {
      const plain = { type: 'object', properties: { note: { type: 'string' } } }
      expect(getMetaValue(undefined, plain, { keepSet: true })).toBeUndefined()
    })

    it('without keepSet, leaves untouched metadata out, as before', () => {
      expect(getMetaValue(undefined, schema)).toBeUndefined()
    })
  })
})
