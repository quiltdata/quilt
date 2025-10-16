import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

import { bucketDir, bucketFile, bucketPackageTree } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import Dashboard from './Dashboard'
import { Provider, useSelection } from './Provider'

jest.mock('constants/config', () => ({}))

function SelectionSetup({ initialSelection }: { initialSelection?: any[] }) {
  const selection = useSelection()
  const [hasSetup, setHasSetup] = React.useState(false)

  React.useEffect(() => {
    if (initialSelection && !hasSetup) {
      initialSelection.forEach(({ items, bucket, path, filter }) => {
        selection.merge(items, bucket, path, filter)
      })
      setHasSetup(true)
    }
  }, [initialSelection, selection, hasSetup])

  return null
}

interface TestWrapperProps {
  children: React.ReactNode
  initialSelection?: any[]
}

// Test component that allows setting up initial selection state
function TestWrapper({ children, initialSelection }: TestWrapperProps) {
  return (
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketDir, bucketFile, bucketPackageTree }}>
        <Provider>
          <SelectionSetup initialSelection={initialSelection} />
          {children}
        </Provider>
      </NamedRoutes.Provider>
    </MemoryRouter>
  )
}

describe('containers/Bucket/Selection/Dashboard', () => {
  it('should render empty state when no selection', () => {
    const { getByText } = render(
      <TestWrapper>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(getByText('Nothing selected')).toBeTruthy()
  })

  it('should render with single file selection', () => {
    const initialSelection = [
      {
        items: [{ logicalKey: 'document.txt' }],
        bucket: 'foo',
        path: 'a/b/c',
      },
    ]

    const { getByText } = render(
      <TestWrapper initialSelection={initialSelection}>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(getByText('s3://foo/a/b/c/document.txt').getAttribute('href')).toBe(
      '/b/foo/tree/a/b/c/document.txt',
    )
  })

  it('should render with special symbols', () => {
    const initialSelection = [
      {
        items: [{ logicalKey: 'a # b.txt' }],
        bucket: 'foo',
        path: 'a/ # b # /c',
      },
    ]

    const { getByText } = render(
      <TestWrapper initialSelection={initialSelection}>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(getByText('s3://foo/a/ # b # /c/a # b.txt').getAttribute('href')).toBe(
      '/b/foo/tree/a/ %23 b %23 /c/a %23 b.txt',
    )
  })
})
