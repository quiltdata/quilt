import { renderHook } from '@testing-library/react-hooks'

import {
  editFileInPackage,
  useAddFileInPackage,
  useEditFileInPackage,
  useParams,
} from './routes'

const useParamsInternal = jest.fn(
  () =>
    ({
      bucket: 'b',
      path: '/a/b/c.txt',
    }) as Record<string, string>,
)

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn(() => useParamsInternal()),
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
  describe('editFileInPackage', () => {
    it('should create url', () => {
      expect(
        editFileInPackage(urls, { bucket: 'bucket', key: 'key' }, 'logicalKey', 'next'),
      ).toEqual('bucketFile(bucket, key, {"add":"logicalKey","edit":true,"next":"next"})')
    })
  })

  describe('useEditFileInPackage', () => {
    it('should create url with redirect to package', () => {
      const { result } = renderHook(() =>
        useEditFileInPackage(
          { bucket: 'b', name: 'n', hash: 'h' },
          { bucket: 'b', key: 'k' },
          'lk',
        ),
      )
      expect(result.current).toBe(
        'bucketFile(b, k, {"add":"lk","edit":true,"next":"bucketPackageDetail(b, n, {\\"action\\":\\"revisePackage\\"})"})',
      )
    })
  })

  describe('useAddFileInPackage', () => {
    it('should create url for the new file', () => {
      const { result } = renderHook(() =>
        useAddFileInPackage({ bucket: 'b', name: 'n', hash: 'h' }, 'lk'),
      )
      expect(result.current).toBe(
        'bucketFile(b, n/lk, {"add":"lk","edit":true,"next":"bucketPackageDetail(b, n, {\\"action\\":\\"revisePackage\\"})"})',
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
