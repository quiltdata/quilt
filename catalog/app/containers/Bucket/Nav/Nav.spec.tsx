import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'

import { Nav } from './Nav'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
}))

// Mock BucketPreferences — mirrors the pattern from Overview/v2/Header.spec.tsx
vi.mock('utils/BucketPreferences', async () => ({
  ...(await vi.importActual<typeof BucketPreferences>('utils/BucketPreferences')),
  use: () => ({
    prefs: BucketPreferences.Result.Ok({
      ui: {
        nav: { files: true, packages: true, workflows: false, queries: false },
      },
    } as unknown as BucketPreferences.BucketPreferences),
  }),
}))

// Mock react-redux — mirrors the pattern from Overview/v2/Header.spec.tsx
vi.mock('react-redux', () => ({
  useSelector: () => true, // authenticated = true
}))

const routes = {
  bucketOverview: { path: '/b/:bucket', url: (bucket: string) => `/b/${bucket}` },
  bucketDir: {
    path: '/b/:bucket/tree/:path(.+/)?',
    url: (bucket: string) => `/b/${bucket}/tree/`,
  },
  bucketWorkflowList: {
    path: '/b/:bucket/workflows',
    url: (bucket: string) => `/b/${bucket}/workflows`,
  },
  bucketPackageList: {
    path: '/b/:bucket/packages/',
    url: (bucket: string) => `/b/${bucket}/packages/`,
  },
  bucketQueries: {
    path: '/b/:bucket/queries',
    url: (bucket: string) => `/b/${bucket}/queries`,
  },
  bucketESQueries: {
    path: '/b/:bucket/queries/es',
    url: (bucket: string) => `/b/${bucket}/queries/es`,
  },
  bucketFile: {
    path: '/b/:bucket/tree/:path(.*[^/])',
    url: (bucket: string, path: string) => `/b/${bucket}/tree/${path}`,
  },
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/b/b']}>
      <NamedRoutes.Provider routes={routes}>
        <Nav bucket="b" />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Nav/Nav', () => {
  afterEach(cleanup)

  it('renders Overview and gated-on items (Files, Packages), hides gated-off items (Workflows, Queries, ElasticSearch)', () => {
    const { getByText, queryByText } = renderNav()

    expect(getByText('Overview')).toBeTruthy()
    expect(getByText('Files')).toBeTruthy()
    expect(getByText('Packages')).toBeTruthy()

    expect(queryByText('Workflows')).toBeNull()
    expect(queryByText('Queries')).toBeNull()
    expect(queryByText('ElasticSearch')).toBeNull()
  })
})
