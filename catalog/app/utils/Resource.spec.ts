import * as Resource from './Resource'

describe('utils/Resource', () => {
  describe('parse', () => {
    describe('Web URLs', () => {
      it('should parse HTTP URLs', () => {
        let url = 'http://example.com'
        expect(Resource.parse(url)).toStrictEqual(Resource.Pointer.Web(url))
      })

      it('should parse HTTPS URLs', () => {
        const url = 'https://example.com/path'
        expect(Resource.parse(url)).toStrictEqual(Resource.Pointer.Web(url))
      })

      it('should parse protocol-relative URLs', () => {
        const url = '//example.com/path'
        expect(Resource.parse(url)).toStrictEqual(Resource.Pointer.Web(url))
      })

      it('should handle URLs with query parameters', () => {
        const url = 'https://example.com/api?param=value'
        expect(Resource.parse(url)).toStrictEqual(Resource.Pointer.Web(url))
      })

      it('should handle URLs with fragments', () => {
        const url = 'https://example.com/page#section'
        expect(Resource.parse(url)).toStrictEqual(Resource.Pointer.Web(url))
      })
    })

    describe('Absolute S3 URLs', () => {
      it('should parse S3 URL with bucket only', () => {
        const bucket = 'my-bucket'
        const key = ''
        expect(Resource.parse(`s3://${bucket}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
        expect(Resource.parse(`s3://${bucket}/`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
      })

      it('should parse S3 URL with bucket and key', () => {
        const bucket = 'my-bucket'
        const key = 'path/to/file.txt'
        expect(Resource.parse(`s3://${bucket}/${key}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
      })

      it('should parse S3 URL with bucket and nested key', () => {
        const bucket = 'test-bucket'
        const key = 'folder/subfolder/data.json'
        expect(Resource.parse(`s3://${bucket}/${key}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
      })

      it('should parse S3 URL for directories', () => {
        const bucket = 'test-bucket'
        const key = 'folder/subfolder/'
        expect(Resource.parse(`s3://${bucket}/${key}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
      })

      it('should handle S3 URLs with hyphens in bucket name', () => {
        const bucket = 'my-test-bucket'
        const key = 'file.txt'
        expect(Resource.parse(`s3://${bucket}/${key}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
      })

      it('should handle S3 URLs with numbers in bucket name', () => {
        const bucket = 'bucket123'
        const key = 'data.csv'
        expect(Resource.parse(`s3://${bucket}/${key}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket, key }),
        )
      })

      it('should throw error for invalid S3 URL format', () => {
        expect(() => Resource.parse('s3://BUCKET/key')).toThrow(
          'Invalid S3 URL: s3://BUCKET/key',
        )
        expect(() => Resource.parse('s3://Invalid_Bucket/key')).toThrow(
          'Invalid S3 URL: s3://Invalid_Bucket/key',
        )
        expect(() => Resource.parse('s3://bucket/../key')).toThrow(
          'Invalid S3 URL: s3://bucket/../key',
        )
      })

      it('should handle absolute S3 URLs "relative" to any bucket', () => {
        const key = 'no/matter/what/bucket'
        expect(Resource.parse(`s3:///${key}`)).toStrictEqual(
          Resource.Pointer.S3({ bucket: undefined, key }),
        )
      })
    })

    describe('Relative S3 URLs', () => {
      it('should parse S3 relative path starting with dot', () => {
        const path = '../relative/path'
        expect(Resource.parse(`s3://${path}`)).toStrictEqual(Resource.Pointer.S3Rel(path))
      })

      it('should parse S3 relative path starting with current directory', () => {
        const path = './current/path'
        expect(Resource.parse(`s3://${path}`)).toStrictEqual(Resource.Pointer.S3Rel(path))
      })

      it('should parse S3 URL with dot bucket as S3', () => {
        const path = '.invalid'
        expect(Resource.parse(`s3://${path}`)).toStrictEqual(Resource.Pointer.S3Rel(path))
      })
    })

    describe('Path URLs', () => {
      it('should parse absolute file path', () => {
        const path = '/absolute/path/to/file.txt'
        expect(Resource.parse(path)).toStrictEqual(Resource.Pointer.Path(path))
      })

      it('should parse relative file path', () => {
        const path = 'relative/path/file.txt'
        expect(Resource.parse(path)).toStrictEqual(Resource.Pointer.Path(path))
      })

      it('should parse file name only', () => {
        const path = 'file.txt'
        expect(Resource.parse(path)).toStrictEqual(Resource.Pointer.Path(path))
      })

      it('should parse path with special characters', () => {
        const path = './path with spaces/file-name_123.txt'
        expect(Resource.parse(path)).toStrictEqual(Resource.Pointer.Path(path))
      })

      it('should parse empty string as path', () => {
        const path = ''
        expect(Resource.parse(path)).toStrictEqual(Resource.Pointer.Path(path))
      })
    })
  })
})
