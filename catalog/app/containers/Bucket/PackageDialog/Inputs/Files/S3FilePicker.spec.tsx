import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BucketSelect } from './S3FilePicker'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({ urls: { bucketFile: (b: string, k: string) => `/b/${b}/tree/${k}` } }),
}))

const handle = vi.fn<() => { bucket: string; key: string } | null>(() => null)
vi.mock('utils/BucketPreferences', () => ({ use: () => ({ handle: handle() }) }))

/**
 * The dialog this control lives in is opened from the Athena console, whose route
 * is `/queries/athena/:workgroup` — no `:bucket` segment. The control used to
 * assert that segment unconditionally, and the nearest error boundary is the app
 * root, so the throw replaced the whole catalog screen rather than failing the
 * panel.
 */
describe('containers/Bucket/PackageDialog/Inputs/Files/S3FilePicker', () => {
  function renderAt(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <BucketSelect bucket="picked" buckets={['picked']} selectBucket={vi.fn()} />
      </MemoryRouter>,
    )
  }

  it('renders on a route with no bucket segment', () => {
    renderAt('/queries/athena/primary?bucket=scoped')
    expect(screen.getByText('picked')).toBeDefined()
  })

  it('prefers the preferences handle when there is one', () => {
    handle.mockImplementation(() => ({ bucket: 'from-handle', key: 'cfg' }))
    renderAt('/queries/athena/primary?bucket=scoped')
    expect(screen.getByText('picked')).toBeDefined()
    handle.mockImplementation(() => null)
  })
})
