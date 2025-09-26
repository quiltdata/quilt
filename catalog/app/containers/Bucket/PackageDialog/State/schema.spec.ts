import { act, renderHook } from '@testing-library/react-hooks'

import { mkMetaValidator, useMetadataSchema, useEntriesSchema, Ready } from './schema'

jest.mock('constants/config', () => ({}))

jest.mock('utils/AWS', () => ({
  S3: {
    use: jest.fn(),
  },
}))

const metadataSchema = jest.fn()
const objectSchema = jest.fn()
jest.mock('../../requests', () => ({
  metadataSchema: ({ s3, ...rest }: any) => Promise.resolve(metadataSchema({ ...rest })),
  objectSchema: ({ s3, ...rest }: any) => Promise.resolve(objectSchema({ ...rest })),
}))

describe('containers/Bucket/PackageDialog/State/schema', () => {
  describe('mkMetaValidator', () => {
    it('should return no error when no metadata', () => {
      expect(mkMetaValidator()(null)).toBeUndefined()
    })

    it('should return error when metadata is not an object', () => {
      expect(mkMetaValidator()(123)).toMatchObject([
        {
          message: 'Metadata must be a valid JSON object',
        },
      ])
    })

    it('should return no error when no Schema and metadata is object', () => {
      expect(mkMetaValidator()({ any: 'thing' })).toBeUndefined()
    })

    it("should return error when metadata isn't compliant with Schema", () => {
      expect(mkMetaValidator({ type: 'array' })({ any: 'thing' })).toMatchObject([
        { message: 'must be array' },
      ])
    })

    it('should return no error when metadata is compliant with Schema', () => {
      expect(
        mkMetaValidator({ type: 'object', properties: { any: { type: 'string' } } })({
          any: 'thing',
        }),
      ).toBeUndefined()
    })
  })

  describe('useMetadataSchema', () => {
    test('should return ready when no workflow', () => {
      const { result } = renderHook(() => useMetadataSchema())

      expect(result.current).toEqual(Ready())
    })

    test('should return ready when workflow has no schema', () => {
      const workflow = { name: 'test' } as any
      const { result } = renderHook(() => useMetadataSchema(workflow))

      expect(result.current).toEqual(Ready())
    })

    test('should call metadataSchema with correct parameters from workflow', async () => {
      const workflow = { schema: { url: 'https://example.com/schema.json' } } as any

      const { waitForNextUpdate, unmount } = renderHook(() => useMetadataSchema(workflow))

      await act(() => waitForNextUpdate())

      expect(metadataSchema).toHaveBeenCalledWith({
        schemaUrl: 'https://example.com/schema.json',
      })
      unmount()
    })
  })

  describe('useEntriesSchema', () => {
    test('should return ready when no workflow', () => {
      const { result } = renderHook(() => useEntriesSchema())

      expect(result.current).toEqual(Ready())
    })

    test('should return ready when workflow has no entriesSchema', () => {
      const workflow = { name: 'test' } as any
      const { result } = renderHook(() => useEntriesSchema(workflow))

      expect(result.current).toEqual(Ready())
    })

    test('should call objectSchema with correct parameters from workflow', async () => {
      const workflow = { entriesSchema: 'https://example.com/entries.json' } as any

      const { waitForNextUpdate, unmount } = renderHook(() => useEntriesSchema(workflow))
      await act(() => waitForNextUpdate())

      expect(objectSchema).toHaveBeenCalledWith({
        schemaUrl: 'https://example.com/entries.json',
      })
      unmount()
    })
  })
})
