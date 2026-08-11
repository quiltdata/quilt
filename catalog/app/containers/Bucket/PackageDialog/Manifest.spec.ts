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

// Mirrors the real fold's precedence: data wins over error when both are present
// (see utils/GraphQL/wrappers.ts), which is what makes a partial response look
// like success unless it is explicitly detected.
vi.mock('utils/GraphQL', () => ({
  useQuery: () => queryState,
  fold: (
    result: QueryState,
    handlers: {
      data: (d: unknown, r: QueryState) => unknown
      fetching: (r: QueryState) => unknown
      error: (e: Error, r: QueryState) => unknown
    },
  ) => {
    if (result.fetching) return handlers.fetching(result)
    if (result.data) return handlers.data(result.data, result)
    if (result.error) return handlers.error(result.error, result)
    return handlers.fetching(result)
  },
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

function run() {
  return renderHook(() => useManifest(params)).result.current
}

describe('containers/Bucket/PackageDialog/Manifest', () => {
  it('resolves a complete response', () => {
    queryState = { data: revision() }
    const res = run()
    expect(res.case({ Ok: () => 'ok', _: () => 'other' })).toBe('ok')
  })

  it('fails a response that carries field errors alongside data', () => {
    // A partial response (HTTP 200 with GraphQL field errors) nulls some fields and
    // resolves others. Accepting it publishes a revision built from the survivors:
    // dropped entries, metadata, or a substituted workflow.
    queryState = {
      data: revision({ contentsFlatMap: null }),
      error: new Error('resolver failed'),
    }
    const res = run()
    expect(res.case({ Err: (e: Error) => e.message, _: () => 'not an error' })).toBe(
      'resolver failed',
    )
  })

  it('fails a partial response that only lost the metadata', () => {
    queryState = {
      data: revision({ userMeta: null }),
      error: new Error('resolver failed'),
    }
    const res = run()
    expect(res.case({ Err: () => 'err', _: () => 'not an error' })).toBe('err')
  })

  it('reports a genuinely oversized manifest as too large', () => {
    // No field error: the registry nulls contentsFlatMap when the manifest exceeds
    // the entry cap, which is permanent and needs different advice than a failure.
    queryState = { data: revision({ contentsFlatMap: null }) }
    const res = run()
    expect(
      res.case({
        Err: (e: Error) => e instanceof errors.ManifestTooLarge,
        _: () => false,
      }),
    ).toBe(true)
  })
})
