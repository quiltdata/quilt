import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import {
  printObject,
  formatQuantity,
  mkFormatQuantity,
  readableQuantity,
  readableBytes,
  trimCenter,
} from './string'

// Render a ReactNode and read its text, normalizing non-breaking spaces so
// assertions stay readable.
const text = (node: React.ReactNode): string =>
  (render(<>{node}</>).container.textContent ?? '').replace(/\u00a0/g, ' ')

describe('utils/string', () => {
  describe('printObject', () => {
    it('pretty-prints JSON with a 2-space indent', () => {
      expect(printObject({ a: 1, b: [2] })).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}')
    })
  })

  describe('formatQuantity', () => {
    it('formats small integers verbatim (no suffix below 1000)', () => {
      expect(text(formatQuantity(0))).toBe('0')
      expect(text(formatQuantity(42))).toBe('42')
      expect(text(formatQuantity(999))).toBe('999')
    })

    it('scales with k/M/G suffixes', () => {
      expect(text(formatQuantity(1000))).toBe('1k')
      expect(text(formatQuantity(1500))).toBe('1.5k')
      expect(text(formatQuantity(1_000_000))).toBe('1M')
      expect(text(formatQuantity(2_500_000_000))).toBe('2.5G')
    })

    it('returns the fallback for non-integers and nullish input', () => {
      expect(formatQuantity(1.5, { fallback: '?' })).toBe('?')
      expect(formatQuantity(null, { fallback: '?' })).toBe('?')
      expect(formatQuantity(undefined, { fallback: 'n/a' })).toBe('n/a')
      expect(formatQuantity(NaN, { fallback: '-' })).toBe('-')
    })

    it('supports a function fallback receiving the raw quantity', () => {
      expect(formatQuantity(1.5, { fallback: (q) => `bad:${q}` })).toBe('bad:1.5')
    })

    it('honors custom suffixes and renderers', () => {
      expect(
        text(
          formatQuantity(2000, {
            suffixes: ['', 'K'],
            renderSuffix: (s) => `_${s}`,
          }),
        ),
      ).toBe('2_K')
    })
  })

  describe('mkFormatQuantity', () => {
    it('builds a reusable formatter bound to options', () => {
      const fmt = mkFormatQuantity({ fallback: '?', Component: 'span' })
      expect(text(fmt(2000))).toBe('2k')
      expect(fmt(null)).toBe('?')
    })
  })

  describe('readableQuantity', () => {
    it('formats integers and falls back to "?" for missing values', () => {
      expect(text(readableQuantity(1500))).toBe('1.5k')
      expect(readableQuantity(null)).toBe('?')
      expect(readableQuantity(undefined)).toBe('?')
    })
  })

  describe('readableBytes', () => {
    it('appends a byte suffix', () => {
      expect(text(readableBytes(1000))).toBe('1 kB')
      expect(text(readableBytes(0))).toBe('0 B')
    })

    it('supports an extra prefix on the suffix', () => {
      expect(text(readableBytes(1000, '+'))).toBe('1+ kB')
    })

    it('falls back to "?" for missing values', () => {
      expect(readableBytes(null)).toBe('?')
      expect(readableBytes(undefined)).toBe('?')
    })
  })

  describe('trimCenter', () => {
    it('returns the input unchanged when within the limit', () => {
      expect(trimCenter('short', 10)).toBe('short')
      expect(trimCenter('exactly-ten', 'exactly-ten'.length)).toBe('exactly-ten')
    })

    it('elides the center of over-long strings', () => {
      const out = trimCenter('abcdefghijklmnopqrstuvwxyz', 12)
      expect(out).toContain(' … ')
      expect(out.startsWith('abcd')).toBe(true)
      expect(out.endsWith('wxyz')).toBe(true)
    })
  })
})
