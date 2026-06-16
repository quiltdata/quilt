import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  bucketDir,
  bucketESQueries,
  bucketFile,
  bucketOverview,
  bucketPackageList,
  bucketQueries,
  bucketWorkflowList,
} from 'constants/routes'
import * as BucketPreferences from 'utils/BucketPreferences'
import { parse } from 'utils/BucketPreferences/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'

import { BucketNav } from './BucketNav'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('react-redux', async () => ({
  ...(await vi.importActual('react-redux')),
  useSelector: () => true,
}))

const prefsHook = vi.fn<() => { prefs: BucketPreferences.Result }>(() => ({
  prefs: BucketPreferences.Result.Init(),
}))

vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual('utils/BucketPreferences')),
  use: () => prefsHook(),
}))

const bucket = 'test-bucket'

function okPrefs(overviewV2: boolean): BucketPreferences.Result {
  const parsed = parse('', bucket)
  return BucketPreferences.Result.Ok({
    ...parsed,
    ui: {
      ...parsed.ui,
      blocks: { ...parsed.ui.blocks, overviewV2 },
    },
  })
}

const routes = {
  bucketDir,
  bucketESQueries,
  bucketFile,
  bucketOverview,
  bucketPackageList,
  bucketQueries,
  bucketWorkflowList,
}

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <NamedRoutes.Provider routes={routes}>
        <BucketNav bucket={bucket} />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/BucketNav', () => {
  afterEach(() => {
    cleanup()
    prefsHook.mockReset()
    prefsHook.mockReturnValue({ prefs: BucketPreferences.Result.Init() })
  })

  it('renders no tabs on the overview route when overviewV2 is enabled', () => {
    prefsHook.mockReturnValue({ prefs: okPrefs(true) })
    const { queryAllByRole } = renderAt(`/b/${bucket}`)
    expect(queryAllByRole('tab')).toHaveLength(0)
  })

  it('renders tabs on the overview route when overviewV2 is disabled', () => {
    prefsHook.mockReturnValue({ prefs: okPrefs(false) })
    const { queryAllByRole } = renderAt(`/b/${bucket}`)
    expect(queryAllByRole('tab').length).toBeGreaterThan(0)
  })

  it('renders tabs on a non-overview route even when overviewV2 is enabled', () => {
    prefsHook.mockReturnValue({ prefs: okPrefs(true) })
    const { queryAllByRole } = renderAt(`/b/${bucket}/packages/`)
    expect(queryAllByRole('tab').length).toBeGreaterThan(0)
  })
})
