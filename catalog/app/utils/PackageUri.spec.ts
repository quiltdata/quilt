import { describe, expect, it } from 'vitest'

import packageUriCases from '../../../shared/package_uri_cases.json'

import * as PackageUri from './PackageUri'

describe('utils/PackageUri', () => {
  describe('parse', () => {
    it.each(packageUriCases.valid)('$name', ({ uri, value }) => {
      expect(PackageUri.parse(uri)).toEqual(value)
    })

    it.each(packageUriCases.invalid)('$name', ({ uri, error }) => {
      expect(() => PackageUri.parse(uri)).toThrowError(error)
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

    it('should work for bucket, name, hash, path & catalog', () => {
      expect(
        PackageUri.stringify({
          bucket: 'bucket-name',
          name: 'quilt/test',
          hash: 'abc1',
          path: 'sub/path',
          catalog: 'quilt-test',
        }),
      ).toBe(
        'quilt+s3://bucket-name#package=quilt/test@abc1&path=sub%2Fpath&catalog=quilt-test',
      )
    })
  })
})
