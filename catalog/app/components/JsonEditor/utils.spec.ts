import { describe, expect, it } from 'vitest'

import { parseJSON } from './utils'

describe('components/JsonEditor/utils', () => {
  describe('parseJSON', () => {
    it('parses JSON values', () => {
      expect(parseJSON('12')).toBe(12)
      expect(parseJSON('[1, "a"]')).toEqual([1, 'a'])
      expect(parseJSON('{"a": 0.5}')).toEqual({ a: 0.5 })
    })

    it('keeps non-JSON text as a string', () => {
      expect(parseJSON('hello')).toBe('hello')
    })

    // a typed number JSON.parse would round must not be stored rounded
    it.each([
      '1e-400',
      '1.0000000000000001',
      '9007199254740993',
      '[1e400]',
      '{"n": 1e-400}',
    ])('keeps %s as typed text instead of a rounded number', (text) => {
      expect(parseJSON(text)).toBe(text)
    })
  })
})
