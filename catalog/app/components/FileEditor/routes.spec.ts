import { renderHook } from '@testing-library/react-hooks'

import {
  useAddFileInPackage,
  useAddFileInBucket,
  useEditFileInPackage,
  useEditBucketFile,
  useParams,
} from './routes'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    packageRoot: 'ro/ot',
  })),
)

const useParamsInternal = jest.fn(
  () =>
    ({
      bucket: 'b',
      path: '/a/b/c.txt',
    }) as Record<string, string>,
)

const useLocationInternal = jest.fn(() => ({
  pathname: '/bucket/b/tree',
  search: '?prefix=foo/',
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => useParamsInternal()),
  useLocation: jest.fn(() => useLocationInternal()),
  Redirect: jest.fn(() => null),
}))

const urls = {
  bucketFile: jest.fn((a, b, c) => `bucketFile(${a}, ${b}, ${JSON.stringify(c)})`),
  bucketPackageDetail: jest.fn(
    (a, b, c) => `bucketPackageDetail(${a}, ${b}, ${JSON.stringify(c)})`,
  ),
}

jest.mock('utils/NamedRoutes', () => ({
  ...jest.requireActual('utils/NamedRoutes'),
  use: jest.fn(() => ({ urls })),
}))

describe('components/FileEditor/routes', () => {
  describe('useEditFileInPackage', () => {
    it('should create url with redirect to package', () => {
      const { result } = renderHook(() =>
        useEditFileInPackage(
          { bucket: 'b', name: 'n', hash: 'h' },
          { bucket: 'b', key: 'k' },
        ),
      )
      expect(result.current('lk')).toBe(
        'bucketFile(b, k, {"add":"quilt+s3://b#package=n&path=lk","edit":true})',
      )
    })
  })

  describe('useAddFileInPackage', () => {
    it('should create url for the new file', () => {
      const { result } = renderHook(() =>
        useAddFileInPackage({ bucket: 'b', name: 'n', hash: 'h' }),
      )
      expect(result.current('lk')).toBe(
        'bucketFile(b, ro/ot/n/lk, {"add":"quilt+s3://b#package=n&path=lk","edit":true})',
      )
    })
  })

  describe('useAddFileInBucket', () => {
    it('should create url for the new file in a bucket', () => {
      const { result } = renderHook(() => useAddFileInBucket('b'))
      expect(result.current('lk')).toBe(`bucketFile(b, lk, {"edit":true})`)
    })
  })

  describe('useEditBucketFile', () => {
    it('should create url with edit flag and next redirect', () => {
      const { result } = renderHook(() =>
        useEditBucketFile({ bucket: 'test-bucket', key: 'config/file.yml' }),
      )
      expect(result.current).toBe(
        'bucketFile(test-bucket, config/file.yml, {"edit":true,"next":"/bucket/b/tree?prefix=foo/"})',
      )
    })
  })

  describe('useParams', () => {
    it('should throw error when no bucket', () => {
      useParamsInternal.mockImplementationOnce(() => ({}))
      const { result } = renderHook(() => useParams())
      expect(result.error).toEqual(new Error('`bucket` must be defined'))
    })

    it('should return initial path', () => {
      const { result } = renderHook(() => useParams())
      expect(result.current.initialPath).toEqual('/a/b/')
    })
  })
})
