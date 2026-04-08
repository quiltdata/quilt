import { describe, expect, it } from 'vitest'

import { parse } from './jsonpath'

describe('utils/jsonpath', () => {
  describe('parse', () => {
    it('should accept dot-notation child access', () => {
      expect(() => parse('$.store.book')).not.toThrow()
    })

    it('should accept wildcard subscript', () => {
      expect(() => parse('$.store.book[*].author')).not.toThrow()
    })

    it('should accept recursive descent', () => {
      expect(() => parse('$..author')).not.toThrow()
    })

    it('should accept wildcard member', () => {
      expect(() => parse('$.store.*')).not.toThrow()
    })

    it('should accept recursive descent with member', () => {
      expect(() => parse('$.store..price')).not.toThrow()
    })

    it('should accept numeric array index', () => {
      expect(() => parse('$..book[2]')).not.toThrow()
    })

    it('should accept script subscript expression', () => {
      expect(() => parse('$..book[(@.length-1)]')).not.toThrow()
    })

    it('should accept negative slice', () => {
      expect(() => parse('$..book[-1:]')).not.toThrow()
    })

    it('should accept union of indices', () => {
      expect(() => parse('$..book[0,1]')).not.toThrow()
    })

    it('should accept array slice', () => {
      expect(() => parse('$..book[:2]')).not.toThrow()
    })

    it('should accept filter expression with existence check', () => {
      expect(() => parse('$..book[?(@.isbn)]')).not.toThrow()
    })

    it('should accept filter expression with comparison', () => {
      expect(() => parse('$..book[?(@.price<10)]')).not.toThrow()
    })

    it('should accept recursive wildcard', () => {
      expect(() => parse('$..*')).not.toThrow()
    })

    it('should reject plain text', () => {
      expect(() => parse('not a path')).toThrow()
    })

    it('should reject empty string', () => {
      expect(() => parse('')).toThrow()
    })

    // Goessner spec does not allow `}` in expressions, but jsonpath-plus
    // silently accepts malformed bracket contents via toPathArray.
    it('should not reject malformed brackets (spec deviation)', () => {
      expect(() => parse('$[}}}')).not.toThrow()
    })

    it('should reject expression missing root', () => {
      expect(() => parse('[invalid')).toThrow()
    })
  })
})
