import { describe, expect, it } from 'vitest'

import type * as workflows from 'utils/workflows'

import { computeDialogStatus } from './dialogStatus'

const config = {} as workflows.WorkflowsConfig

const base = {
  formStatus: { _tag: 'idle' as const },
  manifest: { _tag: 'ready' as const },
  resolveError: null,
  waitingListing: false,
  workflowsConfig: { _tag: 'ready' as const, config },
}

describe('containers/Bucket/PackageDialog/State/dialogStatus', () => {
  it('returns ready when everything is loaded', () => {
    expect(computeDialogStatus(base)).toEqual({ _tag: 'ready' })
  })

  it('returns error when file listing resolution failed', () => {
    const error = new Error('listing')
    expect(computeDialogStatus({ ...base, resolveError: error })).toEqual({
      _tag: 'error',
      error,
    })
  })

  it('returns success when the form was submitted', () => {
    const handle = { bucket: 'b', name: 'n', hash: 'h' }
    expect(
      computeDialogStatus({ ...base, formStatus: { _tag: 'success', handle } }),
    ).toEqual({ _tag: 'success', ...handle })
  })

  it('returns loading while waiting for the file listing', () => {
    expect(computeDialogStatus({ ...base, waitingListing: true })).toEqual({
      _tag: 'loading',
      waitListing: true,
    })
  })

  it('returns loading while the workflows config or manifest is loading', () => {
    expect(
      computeDialogStatus({ ...base, workflowsConfig: { _tag: 'loading', config } }),
    ).toEqual({ _tag: 'loading', waitListing: false })
    expect(computeDialogStatus({ ...base, manifest: { _tag: 'loading' } })).toEqual({
      _tag: 'loading',
      waitListing: false,
    })
  })

  it('keeps rendering the form when the manifest failed to load', () => {
    // Publishing is blocked in useParams instead — see its "unloaded source manifest" cases.
    const error = new Error('manifest')
    expect(computeDialogStatus({ ...base, manifest: { _tag: 'error', error } })).toEqual({
      _tag: 'ready',
    })
  })

  it('returns error when the workflows config failed to load', () => {
    const error = new Error('config')
    expect(
      computeDialogStatus({ ...base, workflowsConfig: { _tag: 'error', error, config } }),
    ).toEqual({ _tag: 'error', error })
  })
})
