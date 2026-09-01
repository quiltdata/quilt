import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: { mode: 'PRODUCT' } }))

vi.mock('utils/AWS', () => ({ S3: { use: () => ({}) } }))

const { fetchFileInCollection } = vi.hoisted(() => ({
  fetchFileInCollection: vi.fn(async (args: { handles: { bucket: string }[] }) => ({
    handle: null,
    body: '',
    requested: args.handles,
  })),
}))
vi.mock('containers/Bucket/requests', () => ({ fetchFileInCollection }))

import { Result } from './BucketPreferences'
import { Provider, use } from './Provider'

function Probe() {
  const { prefs, handle } = use()
  return (
    <div
      data-testid="probe"
      data-prefs={Result.match(
        { Ok: () => 'ok', Pending: () => 'pending', Init: () => 'init' },
        prefs,
      )}
      data-handle={handle ? 'yes' : 'no'}
    />
  )
}

describe('utils/BucketPreferences/Provider', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // Consumers whose scope comes and goes — the workspace Athena console, scoped
  // by `?bucket=` — mount the provider either way, so that losing the scope
  // re-renders their subtree instead of replacing it. With no bucket there is no
  // document, and the state must say so rather than pend on a fetch that will
  // never happen.
  describe('with no bucket in scope', () => {
    it('reads as an uninitialized context and fetches nothing', () => {
      const { getByTestId } = render(
        <Provider bucket={null}>
          <Probe />
        </Provider>,
      )
      expect(getByTestId('probe').dataset.prefs).toBe('init')
      expect(getByTestId('probe').dataset.handle).toBe('no')
      expect(fetchFileInCollection).not.toHaveBeenCalled()
    })
  })

  describe('with a bucket in scope', () => {
    it('fetches that bucket document', () => {
      render(
        <Provider bucket="my-bucket">
          <Probe />
        </Provider>,
      )
      expect(fetchFileInCollection).toHaveBeenCalledTimes(1)
      const { handles } = fetchFileInCollection.mock.calls[0][0]
      expect(handles[0].bucket).toBe('my-bucket')
    })
  })
})
