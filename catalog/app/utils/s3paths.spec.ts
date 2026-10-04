import { createMemoryHistory } from 'history'
import { matchPath } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

import { bucketPackageTree, uriResolver } from 'constants/routes'

import { canonicalKey, decodeRouteParam } from './s3paths'

vi.mock('constants/config', () => ({ default: {} }))

describe('utils/s3paths', () => {
  describe('decodeRouteParam', () => {
    const routeParam = (path: string) => {
      const history = createMemoryHistory()
      history.replace(bucketPackageTree.url('b', 'user/pkg', 'latest', path))
      return matchPath<{ path: string }>(
        history.location.pathname,
        bucketPackageTree.path,
      )!.params.path
    }

    it.each([
      '100%done.csv',
      '100%41.csv',
      'dir with space/a#b?c&d+e=f.csv',
      'имя/файл.txt',
    ])('recovers %s from the history-decoded param', (path) => {
      expect(decodeRouteParam(routeParam(path))).toBe(path)
    })

    it('recovers a Quilt+ URI from the /uri/ route', () => {
      const uri = 'quilt+s3://b#package=user/pkg&path=100%2541.csv'
      const history = createMemoryHistory()
      history.replace(uriResolver.url(uri))
      const param = matchPath<{ uri: string }>(
        history.location.pathname,
        uriResolver.path,
      )!.params.uri
      expect(decodeRouteParam(param)).toBe(uri)
    })

    // Known limitation: history@4 keeps `%2F` but decodes `%252F` to it too.
    it.fails('recovers a literal "%" before a kept hex pair', () => {
      expect(decodeRouteParam(routeParam('a%2Fb.csv'))).toBe('a%2Fb.csv')
    })
  })

  describe('canonicalKey', () => {
    it('produces the key prefixed by package name', () => {
      expect(canonicalKey('foo/bar', 'README.md')).toBe('foo/bar/README.md')
      expect(canonicalKey('foo/bar', 'one/two two/three three three/README.md')).toBe(
        'foo/bar/one/two two/three three three/README.md',
      )
      expect(canonicalKey('foo/bar', 'one/two two/three three three/README.md', '')).toBe(
        'foo/bar/one/two two/three three three/README.md',
      )
    })

    it('throws when logicalKey or package name is empty', () => {
      expect(() => canonicalKey('foo/bar', '', 'root')).toThrow()
      expect(() => canonicalKey('', 'foo/bar', 'root')).toThrow()
    })

    it('produces the key prefixed by package name and packageRoot', () => {
      expect(canonicalKey('foo/bar', 'READ/ME.md', 'root')).toBe(
        'root/foo/bar/READ/ME.md',
      )
      expect(canonicalKey('foo/bar', 'READ/ME.md', '/root/')).toBe(
        'root/foo/bar/READ/ME.md',
      )
      expect(canonicalKey('foo/bar', 'READ?/!ME.md', '//root//')).toBe(
        'root/foo/bar/READ?/!ME.md',
      )
      expect(canonicalKey('foo/bar', 'READ/ME.md', 'one/two two/three three three')).toBe(
        'one/two two/three three three/foo/bar/READ/ME.md',
      )
    })
  })
})
