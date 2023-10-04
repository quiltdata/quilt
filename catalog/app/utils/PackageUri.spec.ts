import * as PackageUri from './PackageUri'

describe('utils/PackageUri', () => {
  describe('parse', () => {
    it('should work for a valid URI w/o tag, hash or path', () => {
      expect(PackageUri.parse('quilt+s3://bucket-name#package=quilt/test')).toEqual({
        bucket: 'bucket-name',
        name: 'quilt/test',
      })
    })

    it('should work for a valid URI w/ tag', () => {
      expect(
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test:latest'),
      ).toEqual({
        bucket: 'bucket-name',
        name: 'quilt/test',
        tag: 'latest',
      })
    })

    it('should work for a valid URI w/ hash and path', () => {
      expect(
        PackageUri.parse(
          'quilt+s3://bucket-name#package=quilt/test@abc1&path=sub%2Fpath',
        ),
      ).toEqual({
        bucket: 'bucket-name',
        name: 'quilt/test',
        hash: 'abc1',
        path: 'sub/path',
      })
    })

    it('should throw on invalid protocol', () => {
      expect(() =>
        PackageUri.parse('quilt+http://bucket-name#package=quilt/test'),
      ).toThrowError('unsupported protocol "quilt+http:"')
    })

    it('should throw on missing slashes', () => {
      expect(() =>
        PackageUri.parse('quilt+s3:bucket-name#package=quilt/test'),
      ).toThrowError('missing slashes')
    })

    it(`should throw when there's no "#"`, () => {
      expect(() => PackageUri.parse('quilt+s3://bucket-name:latest@abc1')).toThrowError(
        'missing "package=" part',
      )
    })

    it('should throw on non-root registry', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name/sub/path#package=quilt/test'),
      ).toThrowError('non-bucket-root registries are not supported')
    })

    it('should throw on missing "package=" part', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#pacakge=quilt/test'),
      ).toThrowError('missing "package=" part')
    })

    it('should throw on multiple "package=" parts', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test&package=quilt/test2'),
      ).toThrowError('"package=" specified multiple times')
    })

    it('should throw on multiple "path=" parts', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test&path=p1&path=p2'),
      ).toThrowError('"path=" specified multiple times')
    })

    it('should throw on empty tag', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test:'),
      ).toThrowError('"package=" part: tag must not be empty')
    })

    it('should throw on more than one ":" in "package="', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test:latest:sup'),
      ).toThrowError('"package=" part may contain only one ":"')
    })

    it('should throw on empty hash', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test@'),
      ).toThrowError('"package=" part: hash must not be empty')
    })

    it('should throw on more than one "@" in "package="', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test@abc1@cde2'),
      ).toThrowError('"package=" part may contain only one "@"')
    })

    it('should throw on both ":" and "@" in "package="', () => {
      expect(() =>
        PackageUri.parse('quilt+s3://bucket-name#package=quilt/test:latest@abc1'),
      ).toThrowError('"package=" part may either contain ":" or "@"')
    })
  })

  describe('stringify', () => {
    it('should throw on missing bucket', () => {
      expect(() => PackageUri.stringify({ name: 'quilt/test' } as any)).toThrowError(
        /missing "bucket"/,
      )
    })

    it('should throw on missing name', () => {
      expect(() => PackageUri.stringify({ bucket: 'bucket' } as any)).toThrowError(
        /missing "name"/,
      )
    })

    it('should throw on both hash and tag', () => {
      expect(() =>
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          tag: 'latest',
          hash: 'abc1',
        }),
      ).toThrowError(/can't have both "hash" and "tag"/)
    })

    it('should work for bucket and name', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
        }),
      ).toBe('quilt+s3://bucket-name#package=quilt/test')
    })

    it('should work for bucket, name and tag', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          tag: 'latest',
        }),
      ).toBe('quilt+s3://bucket-name#package=quilt/test:latest')
    })

    it('should work for bucket, name and hash', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          hash: 'abc1',
        }),
      ).toBe('quilt+s3://bucket-name#package=quilt/test@abc1')
    })

    it('should work for bucket, name and path', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          path: 'sub/path',
        }),
      ).toBe('quilt+s3://bucket-name#package=quilt/test&path=sub%2Fpath')
    })

    it('should work for bucket, name, hash and path', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          hash: 'abc1',
          path: 'sub/path',
        }),
      ).toBe('quilt+s3://bucket-name#package=quilt/test@abc1&path=sub%2Fpath')
    })
  })
})
