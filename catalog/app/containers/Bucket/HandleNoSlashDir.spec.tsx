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

const headObject = jest.fn(() => ({
  promise: () => ({}),
}))

const listObjectsV2 = jest.fn(() => ({
  promise: () => ({
    CommonPrefixes: [{ Prefix: 'foo' }],
  }),
}))

jest.mock('utils/AWS', () => ({
  S3: {
    use: () => ({
      headObject,
      listObjectsV2,
    }),
  },
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Redirect: () => 'redirect',
}))

function TestBucket({ children }: React.PropsWithChildren<{}>) {
  return (
    <NamedRoutes.Provider routes={{ bucketDir, bucketPackageTree }}>
      {children}
    </NamedRoutes.Provider>
  )
}

describe('containers/Bucket/HandleNoSlashDir', () => {
  it('render placeholder', async () => {
    const handle = { bucket: 'b', key: 'k', version: 'some' }
    const tree = create(
      <TestBucket>
        <HandleNoSlashDir handle={handle}>
          <h1>It works</h1>
        </HandleNoSlashDir>
      </TestBucket>,
    ).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('render file content', async () => {
    const handle = { bucket: 'b', key: 'k', version: 'some' }
    const tree = create(
      <TestBucket>
        <HandleNoSlashDir handle={handle}>
          <h1>It works</h1>
        </HandleNoSlashDir>
      </TestBucket>,
    )
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, 100)
        }),
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })

  it('redirects', async () => {
    headObject.mockImplementation(() => ({
      response: {
        httpResponse: {
          headers: {},
        },
      },
      promise: () => {
        throw {
          code: 'NotFound',
        }
      },
    }))
    const handle = { bucket: 'b', key: 'k', version: 'some' }
    const tree = create(
      <TestBucket>
        <HandleNoSlashDir handle={handle}>
          <h1>It works</h1>
        </HandleNoSlashDir>
      </TestBucket>,
    )
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, 100)
        }),
    )
    await act(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve()
          }, 100)
        }),
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})
