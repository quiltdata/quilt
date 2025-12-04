import { act, renderHook } from '@testing-library/react-hooks'
import { vi } from 'vitest'

import { mkMetaValidator, useMetadataSchema, useEntriesSchema, Ready } from './schema'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/AWS', () => ({
  S3: {
    use: vi.fn(),
  },
}))

const metadataSchema = vi.fn()
const objectSchema = vi.fn()
vi.mock('../../requests', () => ({
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
    it('should return ready when no workflow', () => {
      const { result } = renderHook(() => useMetadataSchema())

      expect(result.current).toEqual(Ready())
    })

    it('should return ready when workflow has no schema', () => {
      const workflow = { name: 'test' } as any
      const { result } = renderHook(() => useMetadataSchema(workflow))

      expect(result.current).toEqual(Ready())
    })

    it('should call metadataSchema with correct parameters from workflow', async () => {
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
    it('should return ready when no workflow', () => {
      const { result } = renderHook(() => useEntriesSchema())

      expect(result.current).toEqual(Ready())
    })

    it('should return ready when workflow has no entriesSchema', () => {
      const workflow = { name: 'test' } as any
      const { result } = renderHook(() => useEntriesSchema(workflow))

      expect(result.current).toEqual(Ready())
    })

    it('should call objectSchema with correct parameters from workflow', async () => {
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
