import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { useS3TagsConfig } from './s3Tags'

interface QueryState {
  data?: { bucketConfig: { objectTagsConfig: string | null } | null }
  fetching?: boolean
  error?: Error
}

const useQueryMock = vi.fn<(...args: unknown[]) => QueryState>(() => ({}))

vi.mock('utils/GraphQL', () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  fold: (
    r: QueryState,
    cases: {
      data: (d: unknown, r: QueryState) => unknown
      fetching: (r: QueryState) => unknown
      error: (e: Error, r: QueryState) => unknown
    },
  ) => {
    if (r.data) return cases.data(r.data, r)
    if (r.fetching) return cases.fetching(r)
    return cases.error(r.error!, r)
  },
}))

const run = (state: QueryState, open = true) => {
  useQueryMock.mockReturnValue(state)
  return renderHook(() => useS3TagsConfig(open, 'b')).result.current
}

const withMapping = (objectTagsConfig: string | null) => ({
  data: { bucketConfig: { objectTagsConfig } },
})

describe('containers/Bucket/PackageDialog/State/s3Tags', () => {
  beforeEach(() => useQueryMock.mockReset())

  it('queries the registry on every open and not while closed', () => {
    expect(run({}, false)).toEqual({ config: null, loading: false })
    expect(useQueryMock).toHaveBeenCalledWith(
      expect.anything(),
      { bucket: 'b' },
      {
        pause: true,
        requestPolicy: 'network-only',
      },
    )
    run({ fetching: true })
    expect(useQueryMock).toHaveBeenLastCalledWith(
      expect.anything(),
      { bucket: 'b' },
      { pause: false, requestPolicy: 'network-only' },
    )
  })

  it('is loading while the query runs', () => {
    expect(run({ fetching: true })).toEqual({ config: null, loading: true })
    expect(run({ ...withMapping(null), fetching: true }).loading).toBe(true)
  })

  it('reads no mapping as null and a valid one as its config', () => {
    expect(run(withMapping(null)).config).toBeNull()
    const config = run(withMapping('tags:\n  project: /project\n')).config
    expect(config).not.toBeInstanceOf(Error)
    expect(Object.keys((config as { tags: object }).tags)).toEqual(['project'])
  })

  it('returns an invalid mapping or a failed query as an error', () => {
    expect(run(withMapping('tags: [')).config).toBeInstanceOf(Error)
    expect(run(withMapping('other: 1')).config).toBeInstanceOf(Error)
    const error = new Error('unknown field')
    expect(run({ error }).config).toBe(error)
  })
})
