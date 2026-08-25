import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import Athena from './Athena'

vi.mock('constants/config', () => ({ default: {} }))

// The wiring under test is Wrapper → Model.Provider(preferences). Everything
// below the Provider is irrelevant here, so the probe renders a marker instead
// of children — AthenaContainer and its AWS-backed hooks never mount.
const providerProps = vi.fn()
vi.mock('./model', async () => {
  const utils = await vi.importActual<object>('./model/utils')
  return {
    ...utils,
    Provider: (props: { preferences?: unknown }) => {
      providerProps(props)
      return <div data-testid="model-provider" />
    },
    use: () => {
      throw new Error('not reachable: the Provider probe renders no children')
    },
  }
})

const prefsResult = vi.fn<() => unknown>()
vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<object>('utils/BucketPreferences')
  return {
    ...actual,
    Provider: ({ bucket, children }: { bucket: string; children: React.ReactNode }) => (
      <div data-testid="prefs-provider" data-bucket={bucket}>
        {children}
      </div>
    ),
    use: () => ({ prefs: prefsResult() }),
  }
})

function renderAthena(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Athena />
    </MemoryRouter>,
  )
}

describe('containers/Queries/Athena/Athena', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Wrapper preferences wiring', () => {
    it('passes no preferences without a bucket in scope', () => {
      // The bare global console has no preference document to consult.
      renderAthena('/queries/athena')
      expect(screen.queryByTestId('prefs-provider')).toBeNull()
      expect(providerProps).toHaveBeenCalledTimes(1)
      expect(providerProps.mock.calls[0][0].preferences).toBeUndefined()
    })

    it('threads ui.athena from the ?bucket= scope into the model', async () => {
      // The regression this pins: every legacy /b/:bucket/queries URL redirects
      // here with ?bucket= set, and ui.athena.defaultWorkgroup must keep
      // applying for those — it silently stopped when the console went global.
      const { Result } = await vi.importActual<typeof import('utils/BucketPreferences')>(
        'utils/BucketPreferences',
      )
      const athena = { defaultWorkgroup: 'analytics-prod' }
      prefsResult.mockReturnValue(Result.Ok({ ui: { athena } } as never))
      renderAthena('/queries/athena?bucket=my-bucket')
      expect(screen.getByTestId('prefs-provider').dataset.bucket).toBe('my-bucket')
      expect(providerProps).toHaveBeenCalledTimes(1)
      expect(providerProps.mock.calls[0][0].preferences).toEqual(athena)
    })

    it('holds rendering until the scoped preferences resolve', async () => {
      // Rendering the console before prefs settle would seed the workgroup from
      // localStorage/first-in-list and then not correct it — Init must not
      // reach the model at all.
      const { Result } = await vi.importActual<typeof import('utils/BucketPreferences')>(
        'utils/BucketPreferences',
      )
      prefsResult.mockReturnValue(Result.Init())
      renderAthena('/queries/athena?bucket=my-bucket')
      expect(providerProps).not.toHaveBeenCalled()
      expect(screen.queryByTestId('model-provider')).toBeNull()
    })
  })
})
