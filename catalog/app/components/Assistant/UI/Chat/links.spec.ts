import { describe, expect, it } from 'vitest'

import { toCurrentStack } from './links'

const NIGHTLY = 'https://nightly.quilttest.com'
const STABLE = 'https://open.quiltdata.com'

const STACK_BUCKETS = ['my-bucket', 'b1', 'quilt-example']
const isInStack = (b: string) => STACK_BUCKETS.includes(b)

const rewrite = (href: string, origin = NIGHTLY) =>
  toCurrentStack(href, origin, isInStack)

describe('components/Assistant/UI/Chat/links', () => {
  describe('toCurrentStack', () => {
    it('rewrites a link to this stack’s bucket carrying another stack’s host', () => {
      expect(rewrite(`${STABLE}/b/my-bucket/tree/data/x.csv`)).toBe(
        '/b/my-bucket/tree/data/x.csv',
      )
      // and symmetrically, when the current stack is the stable one
      expect(rewrite(`${NIGHTLY}/b/my-bucket/tree/data/x.csv`, STABLE)).toBe(
        '/b/my-bucket/tree/data/x.csv',
      )
    })

    it('keeps query and hash', () => {
      expect(rewrite(`${STABLE}/b/b1/tree/k.txt?version=abc123&mode=json#L4`)).toBe(
        '/b/b1/tree/k.txt?version=abc123&mode=json#L4',
      )
    })

    it('rewrites package links', () => {
      expect(rewrite(`${STABLE}/b/b1/packages/team/pkg`)).toBe('/b/b1/packages/team/pkg')
    })

    it('leaves links already on the current stack alone', () => {
      const href = `${NIGHTLY}/b/my-bucket/tree/data/x.csv`
      expect(rewrite(href)).toBe(href)
    })

    it('leaves relative links alone', () => {
      expect(rewrite('/b/my-bucket/tree/x.csv')).toBe('/b/my-bucket/tree/x.csv')
      expect(rewrite('#anchor')).toBe('#anchor')
    })

    it('does not hijack external sites that also use /b/ paths', () => {
      // `/b/` is not a namespace Quilt owns; these must survive untouched
      const untouched = [
        'https://www.amazon.com/b/ref=sr_pg_1?node=123',
        'https://www.blogger.com/b/post-create',
        'https://example.com/b/',
        'https://example.com/b/not-our-bucket/tree/x',
      ]
      untouched.forEach((href) => expect(rewrite(href)).toBe(href))
    })

    it('leaves buckets this stack does not serve on their original host', () => {
      // rewriting would 404 here and destroy a link that works
      const href = `${STABLE}/b/somebody-elses-bucket/tree/x`
      expect(rewrite(href)).toBe(href)
    })

    it('leaves non-bucket paths on other hosts alone', () => {
      const untouched = [
        'https://docs.quilt.bio/',
        'https://docs.quilt.bio/Catalog/Qurator.md',
        'https://www.google.com/search?q=quilt',
        'https://example.com/install',
        'https://github.com/quiltdata/quilt',
      ]
      untouched.forEach((href) => expect(rewrite(href)).toBe(href))
    })

    it('leaves non-http schemes alone', () => {
      expect(rewrite('mailto:someone@example.com')).toBe('mailto:someone@example.com')
      // a key starting with `b/` must not be mistaken for a bucket route
      expect(rewrite('s3://my-bucket/b/my-bucket/report.csv')).toBe(
        's3://my-bucket/b/my-bucket/report.csv',
      )
      expect(rewrite('quilt+s3://my-bucket/b/my-bucket')).toBe(
        'quilt+s3://my-bucket/b/my-bucket',
      )
    })

    it('passes unparseable hrefs through', () => {
      expect(rewrite('http://[bad')).toBe('http://[bad')
    })

    it('decodes the bucket segment before matching', () => {
      expect(rewrite(`${STABLE}/b/my%2Dbucket/tree/x`)).toBe('/b/my%2Dbucket/tree/x')
    })
  })
})
