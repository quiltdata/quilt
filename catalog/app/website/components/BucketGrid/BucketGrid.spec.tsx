import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import BucketGrid from './'

vi.mock('constants/config', () => ({ default: { mode: 'OPEN' } }))

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

type Buckets = React.ComponentProps<typeof BucketGrid>['buckets']

const bucket = {
  name: 'bucket-name',
  title: 'Bucket Title',
  iconUrl: 'https://example.com/icon.png',
  description: 'Bucket description',
  tags: null,
  collaborators: null,
}

function renderGrid(buckets: Buckets) {
  return render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <BucketGrid buckets={buckets} />
    </M.MuiThemeProvider>,
  )
}

describe('website/components/BucketGrid', () => {
  afterEach(cleanup)

  it('should render the bucket icon from iconUrl', () => {
    const { container } = renderGrid([bucket])
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/icon.png',
    )
  })

  it('should fall back to the inline stub when iconUrl is empty', () => {
    const { container } = renderGrid([{ ...bucket, iconUrl: null }])
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.MuiSvgIcon-root')).not.toBeNull()
  })

  it('should link the icon to the bucket root, hidden from the tab order', () => {
    const { container } = renderGrid([bucket])
    const link = container.querySelector('img')?.closest('a')
    expect(link?.getAttribute('href')).toBe('/b/bucket-name')
    expect(link?.getAttribute('tabindex')).toBe('-1')
    expect(link?.getAttribute('aria-hidden')).toBe('true')
  })
})
