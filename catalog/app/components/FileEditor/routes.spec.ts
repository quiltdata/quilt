import { renderHook } from '@testing-library/react-hooks'

import { useParams, editFileInPackage } from './routes'

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

describe('components/FileEditor/routes', () => {
  describe('editFileInPackage', () => {
    it('should create url', () => {
      const urls = {
        bucketFile: jest.fn((a, b, c) => `bucketFile(${a}, ${b}, ${JSON.stringify(c)})`),
      }
      expect(
        // @ts-expect-error
        editFileInPackage(urls, { bucket: 'bucket', key: 'key' }, 'logicalKey', 'next'),
      ).toEqual('bucketFile(bucket, key, {"add":"logicalKey","edit":true,"next":"next"})')
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
