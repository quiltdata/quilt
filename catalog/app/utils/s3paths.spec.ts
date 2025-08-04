import { canonicalKey } from './s3paths'

describe('utils/s3paths', () => {
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
