import * as PackageUri from './PackageUri'

// TODO: more coverage
describe('utils/PackageUri', () => {
  describe('parse', () => {
    it('should work', () => {
      expect(
        PackageUri.parse(
          'quilt+s3://bucket-name#package=quilt/test:latest&path=sub/path',
        ),
      ).toEqual({
        bucket: 's3://bucket-name',
        name: 'quilt/test',
        tag: 'latest',
        path: 'sub/path',
      })
    })
  })

  describe('stringify', () => {
    it('should work', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          tag: 'latest',
          path: 'sub/path',
        }),
      ).toBe('quilt+s3://bucket-name#package=quilt/test:latest&path=sub/path')
    })
  })
})
