import { describe, expect, it } from 'vitest'

import { toCurrentStack } from './links'

const NIGHTLY = 'https://nightly.quilttest.com'
const STABLE = 'https://open.quiltdata.com'

describe('components/Assistant/UI/Chat/links', () => {
  describe('toCurrentStack', () => {
    it('rewrites a bucket link from another stack onto the current one', () => {
      expect(toCurrentStack(`${STABLE}/b/my-bucket/tree/data/x.csv`, NIGHTLY)).toBe(
        '/b/my-bucket/tree/data/x.csv',
      )
      // and symmetrically, when the current stack is the stable one
      expect(toCurrentStack(`${NIGHTLY}/b/my-bucket/tree/data/x.csv`, STABLE)).toBe(
        '/b/my-bucket/tree/data/x.csv',
      )
    })

    it('keeps query and hash', () => {
      expect(
        toCurrentStack(`${STABLE}/b/b1/tree/k.txt?version=abc123&mode=json#L4`, NIGHTLY),
      ).toBe('/b/b1/tree/k.txt?version=abc123&mode=json#L4')
    })

    it('rewrites package links', () => {
      expect(toCurrentStack(`${STABLE}/b/b1/packages/team/pkg`, NIGHTLY)).toBe(
        '/b/b1/packages/team/pkg',
      )
    })

    it('leaves links already on the current stack alone', () => {
      const href = `${NIGHTLY}/b/my-bucket/tree/data/x.csv`
      expect(toCurrentStack(href, NIGHTLY)).toBe(href)
    })

    it('leaves relative links alone', () => {
      expect(toCurrentStack('/b/my-bucket/tree/x.csv', NIGHTLY)).toBe(
        '/b/my-bucket/tree/x.csv',
      )
      expect(toCurrentStack('#anchor', NIGHTLY)).toBe('#anchor')
    })

    it('leaves non-bucket paths on other hosts alone', () => {
      // paths that collide with ordinary sites must never be captured
      const untouched = [
        'https://docs.quilt.bio/',
        'https://docs.quilt.bio/Catalog/Qurator.md',
        'https://www.google.com/search?q=quilt',
        'https://example.com/install',
        'https://github.com/quiltdata/quilt',
        'https://example.com/b/',
        'https://example.com/bucket/tree/x',
      ]
      untouched.forEach((href) => expect(toCurrentStack(href, NIGHTLY)).toBe(href))
    })

    it('leaves non-http schemes alone', () => {
      expect(toCurrentStack('mailto:someone@example.com', NIGHTLY)).toBe(
        'mailto:someone@example.com',
      )
      expect(toCurrentStack('s3://my-bucket/k', NIGHTLY)).toBe('s3://my-bucket/k')
    })

    it('passes unparseable hrefs through', () => {
      expect(toCurrentStack('http://[bad', NIGHTLY)).toBe('http://[bad')
    })
  })
})
