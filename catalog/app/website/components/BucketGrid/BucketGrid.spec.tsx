import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import BucketGrid from './'

vi.mock('constants/config', () => ({ default: { mode: 'OPEN' } }))

vi.mock('components/BucketIcon/bucket.svg', () => ({ default: 'DEFAULT_ICON' }))

vi.mock('components/BucketIcon/bucket-white.svg', () => ({
  default: 'CONTRAST_ICON',
}))

vi.mock('./Collaborators', () => ({ default: () => null }))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({
    urls: {
      bucketRoot: (b: string) => `/b/${b}`,
      adminBuckets: () => '/admin/buckets',
    },
  }),
}))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

const bucket = {
  name: 'bucket-name',
  title: 'Bucket Title',
  iconUrl: 'https://example.com/icon.png',
  description: 'Bucket description',
  tags: null,
  collaborators: null,
}

function renderGrid(buckets: (typeof bucket)[]) {
  return render(
    <M.MuiThemeProvider theme={style.websiteTheme}>
      <BucketGrid buckets={buckets} />
    </M.MuiThemeProvider>,
  )
}

describe('website/components/BucketGrid', () => {
  afterEach(cleanup)

  it('should render the bucket icon from iconUrl', () => {
    const { getByAltText } = renderGrid([bucket])
    expect(getByAltText('Bucket Title').getAttribute('src')).toBe(
      'https://example.com/icon.png',
    )
  })

  it('should fall back to the contrast default icon when iconUrl is empty', () => {
    const { getByAltText } = renderGrid([{ ...bucket, iconUrl: null }])
    expect(getByAltText('Bucket Title').getAttribute('src')).toBe('CONTRAST_ICON')
  })
})
