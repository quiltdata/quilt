import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'

import Summary from './Summary'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ urls: {} }) }))
vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual<typeof BucketPreferences>('utils/BucketPreferences')),
  use: () => ({
    prefs: BucketPreferences.Result.Ok({
      ui: { actions: { revisePackage: true }, blocks: { gallery: false } },
    } as unknown as BucketPreferences.BucketPreferences),
  }),
}))
vi.mock('./Summarize', async () => ({
  ...(await vi.importActual('./Summarize')),
  ConfigureAppearance: () => <button>Add README</button>,
}))

const packageHandle = { bucket: 'b', name: 'team/ds', hash: 'h' }

describe('containers/Bucket/Summary', () => {
  it('offers to add a README to an unlocked package', () => {
    const { queryByText } = render(
      <Summary files={[]} mkUrl={null} path="" packageHandle={packageHandle} />,
    )
    expect(queryByText('Add README')).not.toBeNull()
  })

  it('offers no README or summary edits on a locked package', () => {
    const { queryByText } = render(
      <Summary files={[]} mkUrl={null} path="" packageHandle={packageHandle} locked />,
    )
    expect(queryByText('Add README')).toBeNull()
  })
})
