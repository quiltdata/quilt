import * as React from 'react'
import * as M from '@material-ui/core'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

import * as style from 'constants/style'
import * as BucketPreferences from 'utils/BucketPreferences'
import { extendDefaults } from 'utils/BucketPreferences/BucketPreferences'

import { PackageRevisions } from './PackageRevisions'

const { useLock } = vi.hoisted(() => ({ useLock: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('react-redux', () => ({ useSelector: () => false }))
vi.mock('utils/PackageLock', async () => ({
  ...(await vi.importActual<typeof import('utils/PackageLock')>('utils/PackageLock')),
  useLock,
}))
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({ fetching: true }),
  useMutation: () => vi.fn(),
  fold: () => null,
}))
vi.mock('utils/NamedRoutes', () => ({
  use: () => ({
    urls: { bucketPackageDetail: () => '/', bucketPackageRevisions: () => '/' },
  }),
}))

const seen: BucketPreferences.Result[] = []
function Probe() {
  seen.push(BucketPreferences.use().prefs)
  return null
}
vi.mock('../PackageDialog', () => ({
  useCreateDialog: () => ({ render: () => <Probe /> }),
}))

const actions = (prefs: BucketPreferences.Result) =>
  BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions: a } }) => ({
        revisePackage: a.revisePackage,
        writeFile: a.writeFile,
      }),
      _: () => null,
    },
    prefs,
  )

function descendantActions(status: string) {
  useLock.mockReturnValue({ status, lock: null })
  seen.length = 0
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <MemoryRouter>
        <BucketPreferences.Override
          prefs={BucketPreferences.Result.Ok(extendDefaults({}))}
        >
          <PackageRevisions bucket="b" name="team/ds" />
        </BucketPreferences.Override>
      </MemoryRouter>
    </M.MuiThemeProvider>,
  )
  return actions(seen[seen.length - 1])
}

describe('containers/Bucket/PackageRevisions prefs', () => {
  it('turns write actions off for descendants of a locked package', () => {
    expect(descendantActions('locked')).toEqual({
      revisePackage: false,
      writeFile: false,
    })
  })

  it('leaves them on for an unlocked package', () => {
    expect(descendantActions('unlocked')).toEqual({
      revisePackage: true,
      writeFile: true,
    })
  })
})
