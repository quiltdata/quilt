import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

import { bucketDir, bucketFile, bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import Dashboard from './Dashboard'
import { Provider, useSelection } from './Provider'
import type { merge } from './utils'

vi.mock('constants/config', () => ({ default: {} }))

interface SelectionSetupProps {
  mergeWith: Parameters<typeof merge>
}

function SelectionSetup({ mergeWith }: SelectionSetupProps) {
  const selection = useSelection()
  const [hasSetup, setHasSetup] = React.useState(false)

  React.useEffect(() => {
    if (!hasSetup) {
      selection.merge(...mergeWith)
      setHasSetup(true)
    }
  }, [mergeWith, selection, hasSetup])

  return null
}

type TestWrapperProps = React.PropsWithChildren<Partial<SelectionSetupProps>>

function TestWrapper({ children, mergeWith }: TestWrapperProps) {
  return (
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketDir, bucketFile, bucketPackageTree }}>
        <Provider>
          {mergeWith && <SelectionSetup mergeWith={mergeWith} />}
          {children}
        </Provider>
      </NamedRoutes.Provider>
    </MemoryRouter>
  )
}

describe('containers/Bucket/Selection/Dashboard', () => {
  const bucket = 'foo'

  it('should render empty state when no selection', () => {
    const { getByText } = render(
      <TestWrapper>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(getByText('Nothing selected')).toBeTruthy()
  })

  it('should render with single file selection', () => {
    const path = 'a/b/c'
    const items = [{ logicalKey: 'document.txt' }]

    const { getByText } = render(
      <TestWrapper mergeWith={[items, bucket, path]}>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(getByText('s3://foo/a/b/c')).toBeTruthy()
    expect(getByText('s3://foo/a/b/c/document.txt').getAttribute('href')).toBe(
      '/b/foo/tree/a/b/c/document.txt',
    )
  })

  it('should render with special symbols', () => {
    const path = 'a/ # b # /c'
    const items = [{ logicalKey: 'a # b.txt' }]

    const { getByText, queryByText } = render(
      <TestWrapper mergeWith={[items, bucket, path]}>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(queryByText('s3://foo/a/ %23 b %23 /c')).toBeFalsy()
    expect(getByText('s3://foo/a/ # b # /c')).toBeTruthy()
    expect(getByText('s3://foo/a/ # b # /c/a # b.txt').getAttribute('href')).toBe(
      '/b/foo/tree/a/ %23 b %23 /c/a %23 b.txt',
    )
  })
})
