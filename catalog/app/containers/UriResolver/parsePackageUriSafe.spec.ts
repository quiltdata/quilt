import { describe, it, expect, vi } from 'vitest'

import * as PackageUri from 'utils/PackageUri'

import parsePackageUriSafe from './parsePackageUriSafe'

vi.mock('utils/PackageUri', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/PackageUri')>()
  return { ...actual, parse: vi.fn(actual.parse) }
})

describe('containers/UriResolver/parsePackageUriSafe', () => {
  it('should return the parsed URI when it is valid', () => {
    expect(parsePackageUriSafe('quilt+s3://bucket-name#package=quilt/test')).toEqual({
      bucket: 'bucket-name',
      name: 'quilt/test',
    })
  })

  it('should return, not throw, a PackageUriError when the URI is invalid', () => {
    const result = parsePackageUriSafe('quilt+http://bucket-name#package=quilt/test')
    expect(result).toBeInstanceOf(PackageUri.PackageUriError)
    expect((result as PackageUri.PackageUriError).msg).toMatch(/unsupported protocol/)
  })

  it('should interpolate the underlying error for a non-PackageUriError throw', () => {
    vi.mocked(PackageUri.parse).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    const result = parsePackageUriSafe('quilt+s3://bucket-name#package=quilt/test')
    expect(result).toBeInstanceOf(PackageUri.PackageUriError)
    const { msg } = result as PackageUri.PackageUriError
    expect(msg).not.toContain('${e}')
    expect(msg).toContain('boom')
  })
})
