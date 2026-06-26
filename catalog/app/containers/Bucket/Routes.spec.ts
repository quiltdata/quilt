import { Schema as S } from 'effect'
import { describe, it, expect } from 'vitest'

import { s3Object, s3Prefix } from './Routes'

/**
 * Round-trip guard for the S3 object/prefix routes: a `path` param decoded out
 * of a URL must encode back to the same URL (and vice-versa). This pins the
 * effect-Schema <-> path-to-regexp encoding seam that the effect 3.21 bump
 * touched (branded `S3Path`, non-strict `fromPathParams`).
 *
 * Scope: the byte classes that real S3 keys hit — spaces, URI-significant
 * characters (`#`, `?`), non-ASCII, and nested/trailing slashes. The point is
 * to cover what the catalog actually needs, not every theoretically-valid key;
 * the known boundary is encoded explicitly at the bottom of this file.
 */

const roundTrip =
  (route: { paramsSchema: S.Schema<any, any> }) =>
  (path: string): string => {
    const loc = S.encodeSync(route.paramsSchema)({ bucket: 'b', path } as any)
    return (S.decodeSync(route.paramsSchema)(loc) as { path: string }).path
  }

const objectRoundTrip = roundTrip(s3Object)
const prefixRoundTrip = roundTrip(s3Prefix)

describe('Bucket S3 routes: path encoding', () => {
  // Encoding is per-segment: URI-significant bytes are percent-encoded, but the
  // `/` separators are preserved so multi-segment keys still match `:path`.
  it('percent-encodes per segment and preserves separators', () => {
    const { pathname } = S.encodeSync(s3Object.paramsSchema)({
      bucket: 'b',
      path: 'with space/and#hash/q?uery.txt',
    } as any) as { pathname: string }
    expect(pathname).toBe('/b/b/tree/with%20space/and%23hash/q%3Fuery.txt')
  })

  describe('object keys round-trip', () => {
    it.each([
      'plain/key.txt',
      'a/b/c/deep.csv',
      'with space/and#hash/q?uery.txt',
      'unicode/имя/файл.txt',
      'has+plus and&amp.txt',
    ])('%s', (path) => {
      expect(objectRoundTrip(path)).toBe(path)
    })
  })

  describe('prefix keys round-trip', () => {
    it.each(['some dir/sub dir/', 'q?#/x/'])('%s', (path) => {
      expect(prefixRoundTrip(path)).toBe(path)
    })
  })

  // BOUNDARY (known, pre-existing — not introduced by the effect 3.21 bump):
  // a literal `%` in a key is not round-trip-safe, because the URL->params path
  // decodes twice (path-to-regexp's matcher, then `S3PathFromString.decode`)
  // against a single encode. `%`+hex silently corrupts (`a%41b` -> `aAb`) and
  // `%`+non-hex throws. Tracked in qhq-yoxv. These are written as expected
  // failures asserting the *desired* round-trip: they pass today (the body
  // fails) and flip RED the day the seam is fixed, prompting their removal —
  // rather than pinning the corrupt output as a green contract.
  it.fails('round-trips a literal "%" + hex key (xfail until qhq-yoxv)', () => {
    expect(objectRoundTrip('a%41b.txt')).toBe('a%41b.txt')
  })

  it.fails('round-trips a literal "%" + non-hex key (xfail until qhq-yoxv)', () => {
    expect(objectRoundTrip('a%zz.txt')).toBe('a%zz.txt')
  })
})
