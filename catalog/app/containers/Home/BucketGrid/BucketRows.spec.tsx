import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import BucketRows from './BucketRows'
import type { VolumeEntry } from './entries'

// PRODUCT mode so the collaborator readout renders at all.
vi.mock('constants/config', () => ({ default: { mode: 'PRODUCT' } }))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({
    urls: {
      bucketRoot: (b: string) => `/b/${b}`,
      dataProduct: (id: string) => `/p/${id}`,
    },
  }),
}))

vi.mock('components/BucketIcon', () => ({
  default: () => <div data-testid="bucket-icon" />,
}))

vi.mock('./Collaborators', () => ({
  default: () => <button type="button">Shared with 15+</button>,
}))

const BUCKET = {
  name: 'quilt-bio-production',
  title: 'Production datasets',
  iconUrl: null,
  description: null,
  tags: ['prod', 'bio', 'flow'],
}

const renderRows = (entries: ReadonlyArray<VolumeEntry>) =>
  render(
    <MemoryRouter>
      <M.MuiThemeProvider theme={style.appTheme}>
        <BucketRows entries={entries} />
      </M.MuiThemeProvider>
    </MemoryRouter>,
  )

describe('containers/Home/BucketGrid/BucketRows', () => {
  afterEach(cleanup)

  // jsdom does no layout, so the overlap itself is not observable; what keeps
  // the readout and the tags apart is that neither is positioned out of flow.
  it('keeps the access readout in flow, not in the absolute secondary slot', () => {
    const { container, getByText } = renderRows([
      {
        kind: 'bucket',
        label: BUCKET.title,
        sortKey: BUCKET.name,
        relevance: 0,
        bucket: BUCKET,
      },
    ])
    expect(getByText('Shared with 15+')).toBeTruthy()
    expect(getByText('prod')).toBeTruthy()
    expect(container.querySelector('.MuiListItemSecondaryAction-root')).toBeNull()
  })
})
