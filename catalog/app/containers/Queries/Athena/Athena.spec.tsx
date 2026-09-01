import * as React from 'react'
import { createMemoryHistory } from 'history'
import { MemoryRouter, Router } from 'react-router-dom'
import { act, render, cleanup, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { Result, extendDefaults } from 'utils/BucketPreferences/BucketPreferences'

import Athena from './Athena'

vi.mock('constants/config', () => ({ default: {} }))

// The wiring under test is Wrapper → Model.Provider(preferences). Everything
// below the Provider is irrelevant here, so the probe renders a marker instead
// of children — AthenaContainer and its AWS-backed hooks never mount.
const providerProps = vi.fn()
const providerMounts = vi.fn()
vi.mock('./model', async () => {
  const utils = await vi.importActual<object>('./model/utils')
  return {
    ...utils,
    Provider: (props: { preferences?: unknown }) => {
      providerProps(props)
      // Counts mounts, not renders: the point of a single `Model.Provider`
      // element is that a change of scope re-renders it instead of replacing it.
      React.useEffect(() => {
        providerMounts()
      }, [])
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
    Provider: ({
      bucket,
      children,
    }: {
      bucket: string | null
      children: React.ReactNode
    }) => (
      <div data-testid="prefs-provider" data-bucket={bucket}>
        {children}
      </div>
    ),
    use: () => ({ prefs: prefsResult() }),
  }
})

const athenaPrefs = (athena: object) => Result.Ok(extendDefaults({ ui: { athena } }))

function renderAthena(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Athena />
    </MemoryRouter>,
  )
}

describe('containers/Queries/Athena/Athena', () => {
  beforeEach(() => {
    // What the provider serves with no bucket in scope: no document, and
    // nothing pending on one either.
    prefsResult.mockReturnValue(Result.Init())
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Wrapper preferences wiring', () => {
    it('passes no preferences without a bucket in scope', () => {
      // The bare global console has no preference document to consult.
      renderAthena('/queries/athena')
      expect(screen.getByTestId('prefs-provider').dataset.bucket).toBeUndefined()
      expect(providerProps).toHaveBeenCalledTimes(1)
      expect(providerProps.mock.calls[0][0].preferences).toBeUndefined()
    })

    it('threads ui.athena from the ?bucket= scope into the model', () => {
      // The regression this pins: a legacy /b/:bucket/queries URL redirects here
      // with ?bucket= set, and ui.athena.defaultWorkgroup must keep applying for
      // those — it silently stopped when the console went global.
      const athena = { defaultWorkgroup: 'analytics-prod' }
      // Through the real parse pipeline, so a change to how `ui.athena` is
      // parsed shows up here rather than being mocked away.
      prefsResult.mockReturnValue(athenaPrefs(athena))
      renderAthena('/queries/athena?bucket=my-bucket')
      expect(screen.getByTestId('prefs-provider').dataset.bucket).toBe('my-bucket')
      expect(providerProps).toHaveBeenCalledTimes(1)
      expect(providerProps.mock.calls[0][0].preferences).toEqual(athena)
    })

    it('holds rendering until the scoped preferences resolve', () => {
      // Rendering the console before prefs settle would seed the workgroup from
      // localStorage/first-in-list and then not correct it — Init must not
      // reach the model at all.
      renderAthena('/queries/athena?bucket=my-bucket')
      expect(providerProps).not.toHaveBeenCalled()
      expect(screen.queryByTestId('model-provider')).toBeNull()
    })
  })

  describe('a change of scope', () => {
    // `Model.Provider` owns the query being typed and the selected catalog and
    // database. React reconciles by position, so if the scoped and unscoped
    // consoles were different trees, losing the scope — clicking the "Athena"
    // tab, say — would remount the console and discard all of it.
    it('re-renders the console rather than remounting it', () => {
      prefsResult.mockReturnValue(athenaPrefs({ defaultWorkgroup: 'analytics-prod' }))
      const history = createMemoryHistory({
        initialEntries: ['/queries/athena/primary?bucket=my-bucket'],
      })
      render(
        <Router history={history}>
          <Athena />
        </Router>,
      )
      expect(providerMounts).toHaveBeenCalledTimes(1)

      prefsResult.mockReturnValue(Result.Init())
      act(() => {
        history.push('/queries/athena/primary')
      })

      expect(providerMounts).toHaveBeenCalledTimes(1)
      expect(providerProps.mock.calls.at(-1)?.[0].preferences).toBeUndefined()
    })
  })
})
