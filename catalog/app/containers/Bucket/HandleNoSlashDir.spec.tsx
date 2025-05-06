import * as React from 'react'
import { act, create } from 'react-test-renderer'

import { bucketDir, bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import HandleNoSlashDir from './HandleNoSlashDir'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock('components/Placeholder', () => () => <h1>Loading…</h1>)

const headObjectPromise = jest.fn(() => ({}))

const listObjectsV2Promise = jest.fn(() => ({
  CommonPrefixes: [{ Prefix: 'foo' }],
}))

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

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Redirect: () => 'redirect',
}))

function wait(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, timeout)
  })
}

describe('containers/Bucket/HandleNoSlashDir', () => {
  const handle = { bucket: 'b', key: 'k', version: 'some' }

  function TestWrapper() {
    return (
      <NamedRoutes.Provider routes={{ bucketDir, bucketPackageTree }}>
        <HandleNoSlashDir handle={handle}>
          <h1>It works</h1>
        </HandleNoSlashDir>
      </NamedRoutes.Provider>
    )
  }

  it('renders placeholder', async () => {
    const tree = create(<TestWrapper />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders file content', async () => {
    const tree = create(<TestWrapper />)
    await act(() => wait(100))
    expect(tree.toJSON()).toMatchSnapshot()
  })

  it('redirects', async () => {
    headObjectPromise.mockImplementation(() => {
      throw {
        code: 'NotFound',
      }
    })
    const tree = create(<TestWrapper />)
    await act(() => wait(100)) // object request and state change
    await act(() => wait(100)) // listing request and state change
    expect(tree.toJSON()).toMatchSnapshot()
  })
})
