import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

import { bucketDir, bucketFile, signIn } from 'constants/routes'
import AsyncResult from 'utils/AsyncResult'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as requests from './requests'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ bucket: 'test-bucket', path: 'restricted/' }),
}))

vi.mock('constants/config', () => ({ default: {} }))

const authenticated = vi.fn(() => true)

vi.mock('react-redux', () => ({ useSelector: () => authenticated() }))

vi.mock('utils/AWS', () => ({ S3: { use: () => ({}) } }))

const listingResult = vi.fn<() => unknown>()

vi.mock('utils/Data', () => ({
  useData: () => ({
    case: (cases: Record<string, Function>, ...args: unknown[]) =>
      AsyncResult.case(cases, listingResult(), ...args),
    result: listingResult(),
  }),
}))

vi.mock('./Selection', async () => ({
  ...(await vi.importActual<typeof import('./Selection')>('./Selection')),
  use: () => ({ inited: true, isEmpty: true, selection: {}, merge: vi.fn() }),
}))

vi.mock('./Dir/Toolbar', () => ({
  Toolbar: () => <div data-testid="toolbar" />,
  CreateHandle: (bucket: string, path: string) => ({ bucket, path }),
  useFeatures: () => ({}),
}))

vi.mock('./DirAssistantContext', () => ({
  ListingContext: () => null,
  DirContextFiles: () => null,
}))

// A ListObjectsV2 denial as the SDK surfaces it for a same-account role: code
// `AccessDenied`, with a message naming the denied action.
const listDenied = () =>
  requests
    .bucketListing({
      s3: {
        listObjectsV2: () => ({
          promise: () =>
            Promise.reject(
              Object.assign(
                new Error(
                  'User: arn:aws:sts::000000000000:assumed-role/r/s is not authorized to perform: s3:ListBucket',
                ),
                { code: 'AccessDenied', statusCode: 403 },
              ),
            ),
        }),
      } as never,
      bucket: 'test-bucket',
      path: 'restricted/',
    })
    .catch((e: unknown) => e)

let Dir: React.ComponentType<React.PropsWithChildren<unknown>>

beforeAll(async () => {
  Dir = (await import('./Dir')).default
})

function renderDir() {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketDir, bucketFile, signIn }}>
        <Dir />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Dir', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows Access Denied below the breadcrumbs when the folder cannot be listed', async () => {
    listingResult.mockReturnValue(AsyncResult.Err(await listDenied()))

    const { getByText, getByTestId } = renderDir()

    expect(getByText('Access Denied')).toBeTruthy()
    expect(getByText(/permission to list this folder/)).toBeTruthy()
    expect(getByText('test-bucket').closest('a')).toBeTruthy()
    expect(getByTestId('toolbar')).toBeTruthy()
  })

  it('keeps the sign-in prompt for an anonymous user', async () => {
    authenticated.mockReturnValue(false)
    listingResult.mockReturnValue(AsyncResult.Err(await listDenied()))

    const { getByText } = renderDir()

    expect(getByText(/Please sign in/)).toBeTruthy()
    authenticated.mockReturnValue(true)
  })

  it('contains any other listing failure to the listing panel', () => {
    listingResult.mockReturnValue(AsyncResult.Err(new Error('listing failed')))

    const { getByText, getByTestId } = renderDir()

    expect(getByText('This folder could not be listed')).toBeTruthy()
    expect(getByTestId('toolbar')).toBeTruthy()
  })
})
