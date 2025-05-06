import * as React from 'react'
import { act, create } from 'react-test-renderer'

import { bucketDir, bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import HandleNoSlashDir from './HandleNoSlashDir'
import { NoSuchBucket } from './errors'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock('components/Placeholder', () => () => 'Loading…')

jest.mock(
  'components/Message',
  () =>
    ({ headline, children }: { headline: string; children: string }) =>
      `Title: ${headline}\nContent: ${children}`,
)

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Redirect: () => 'redirect',
}))

const headObjectPromise = jest.fn(() => ({}))

const listObjectsV2Promise = jest.fn(() => ({
  CommonPrefixes: [{ Prefix: 'foo' }],
}))

const listObjectsV2Error = new NoSuchBucket()

jest.mock('utils/AWS', () => ({
  S3: {
    use: () => ({
      headObject: jest.fn(() => ({
        response: {
          httpResponse: {
            headers: {},
          },
        },
        promise: headObjectPromise,
      })),
      listObjectsV2: jest.fn(() => ({
        promise: listObjectsV2Promise,
      })),
    }),
  },
}))

function wait(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), timeout)
  })
}

describe('containers/Bucket/HandleNoSlashDir', () => {
  const handle = { bucket: 'b', key: 'k', version: 'some' }

  function TestWrapper() {
    return (
      <NamedRoutes.Provider routes={{ bucketDir, bucketPackageTree }}>
        <HandleNoSlashDir handle={handle}>It works!</HandleNoSlashDir>
      </NamedRoutes.Provider>
    )
  }

  it('renders placeholder', async () => {
    const tree = create(<TestWrapper />)
    expect(tree.toJSON()).toMatchSnapshot()
  })

  it('renders file content', async () => {
    const tree = create(<TestWrapper />)
    await act(() => wait(100)) // object request and state change
    expect(tree.toJSON()).toMatchSnapshot()
    tree.unmount()
  })

  it('renders error', async () => {
    headObjectPromise.mockImplementation(() => {
      throw {
        code: 'NotFound',
      }
    })
    listObjectsV2Promise.mockImplementation(() => {
      throw listObjectsV2Error
    })
    const tree = create(<TestWrapper />)
    await act(() => wait(100)) // object request and state change
    await act(() => wait(100)) // listing request and state change
    expect(tree.toJSON()).toMatchSnapshot()
    tree.unmount()
  })

  it('redirects', async () => {
    headObjectPromise.mockImplementation(() => {
      throw {
        code: 'NotFound',
      }
    })
    listObjectsV2Promise.mockImplementation(() => ({
      CommonPrefixes: [{ Prefix: 'foo' }],
    }))
    const tree = create(<TestWrapper />)
    await act(() => wait(100)) // object request and state change
    await act(() => wait(100)) // listing request and state change
    expect(tree.toJSON()).toMatchSnapshot()
    tree.unmount()
  })
})
