import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'
import { makeSchemaDefaultsSetter } from 'utils/JSONSchema'
import {
  mkMetaValidator,
  mkSubmitValidator,
  useMetadataSchema,
  useEntriesSchema,
  Ready,
} from './schema'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/AWS', () => ({
  S3: {
    use: noop,
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

describe('mkMetaValidator formats option', () => {
  const anyOfDate = {
    type: 'object',
    properties: {
      when: { anyOf: [{ type: 'string', format: 'date' }, { type: 'number' }] },
    },
  }

  it('reports a format failure inside anyOf when formats are on', () => {
    expect(mkMetaValidator(anyOfDate)({ when: 'last tuesday' })).toBeTruthy()
  })

  it('does not block on it when formats are off', () => {
    expect(
      mkMetaValidator(anyOfDate, { formats: false })({ when: 'last tuesday' }),
    ).toBeUndefined()
  })
})

describe('mkMetaValidator keepSet', () => {
  const required = {
    type: 'object',
    required: ['paired'],
    properties: { paired: { type: 'boolean', default: false } },
  }

  it('validates the same object submit sends: a false default is materialized', () => {
    const setDefaults = makeSchemaDefaultsSetter(required, { keepSet: true })
    expect(setDefaults({})).toEqual({ paired: false })
    expect(mkMetaValidator(required, { keepSet: true })({})).toBeUndefined()
  })

  it('does not pass on a default Ajv would add only to its own copy', () => {
    const viaRef = {
      type: 'object',
      required: ['lane'],
      allOf: [{ properties: { lane: { type: 'number', default: 1 } } }],
    }
    expect(mkMetaValidator(viaRef, { keepSet: true })({})).toBeTruthy()
  })
})

describe('mkSubmitValidator', () => {
  const either = {
    type: 'object',
    properties: {
      when: {
        oneOf: [
          { type: 'string', format: 'date' },
          { type: 'string', format: 'uri' },
        ],
      },
    },
  }

  it('blocks a value the server rejects: without formats both oneOf branches match', () => {
    expect(mkSubmitValidator(either)({ when: '2026-10-07' }).length).toBeGreaterThan(0)
  })

  it('still relaxes a failure that is only about format', () => {
    const dated = {
      type: 'object',
      properties: { when: { type: 'string', format: 'date' } },
    }
    expect(mkSubmitValidator(dated)({ when: 'last tuesday' })).toEqual([])
  })

  it('still blocks a real type error', () => {
    const num = { type: 'object', properties: { n: { type: 'number' } } }
    expect(mkSubmitValidator(num)({ n: 'x' }).length).toBeGreaterThan(0)
  })
})
