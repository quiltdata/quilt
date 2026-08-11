import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as errors from '../errors'

import { useManifest } from './Manifest'

interface QueryState {
  data?: unknown
  error?: Error
  fetching?: boolean
}

let queryState: QueryState = {}

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

// The real fold decides what a partial response means, so only the query is faked.
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useQuery: () => queryState,
}))

const params = { bucket: 'b', name: 'p', hashOrTag: 'latest' }

const revision = (over: Record<string, unknown> = {}) => ({
  package: {
    revision: {
      hash: 'h',
      contentsFlatMap: { 'a.csv': { size: 1 } },
      userMeta: { project: 'x' },
      workflow: { id: 'w' },
      ...over,
    },
  },
})

const run = () => renderHook(() => useManifest(params)).result.current

describe('containers/Bucket/PackageDialog/Manifest', () => {
  it('resolves a complete response', () => {
    queryState = { data: revision() }
    expect(run().case({ Ok: () => 'ok', _: () => 'other' })).toBe('ok')
  })

  it('fails a response that carries field errors alongside data', () => {
    // Such a response nulls some fields and resolves others, so accepting it publishes a
    // revision built from the survivors — whichever field was lost. Any of them: entries,
    // metadata, or the workflow that would otherwise fall back to the bucket default.
    queryState = {
      data: revision({ contentsFlatMap: null, userMeta: null }),
      error: new Error('resolver failed'),
    }
    expect(run().case({ Err: (e: Error) => e.message, _: () => 'not an error' })).toBe(
      'resolver failed',
    )
  })

  it('reports a genuinely oversized manifest as too large', () => {
    // No field error: the registry nulls contentsFlatMap when the manifest exceeds the
    // entry cap, which is permanent and needs different advice than a failure.
    queryState = { data: revision({ contentsFlatMap: null }) }
    expect(
      run().case({
        Err: (e: Error) => e instanceof errors.ManifestTooLarge,
        _: () => false,
      }),
    ).toBe(true)
  })
})
