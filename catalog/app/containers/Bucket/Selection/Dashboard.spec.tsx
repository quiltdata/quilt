import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

import Dashboard from './Dashboard'
import { Provider, useSelection } from './Provider'

type WithChildren = React.PropsWithChildren<{}>

// Mock Material-UI components
jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  Button: ({ children }: WithChildren) => <button role="button">{children}</button>,
  Divider: () => <hr />,
  List: ({ children }: WithChildren) => <ul>{children}</ul>,
  ListItem: ({ children }: WithChildren) => <li>{children}</li>,
  ListItemIcon: ({ children }: WithChildren) => <figure>{children}</figure>,
  ListItemSecondaryAction: ({ children }: WithChildren) => <div>{children}</div>,
  ListSubheader: ({ children }: WithChildren) => <li role="title">{children}</li>,
  Icon: ({ children }: WithChildren) => <figure>{children}</figure>,
  IconButton: ({ children }: WithChildren) => <button role="button">{children}</button>,
  Typography: ({ children }: WithChildren) => <p>{children}</p>,
}))

// Mock dependencies
jest.mock('../FileView', () => ({
  ZipDownloadForm: ({ children, ...props }: any) => (
    <div data-testid="zip-download-form" {...props}>
      {children}
    </div>
  ),
}))

jest.mock('utils/NamedRoutes', () => ({
  ...jest.requireActual('utils/NamedRoutes'),
  use: () => ({
    urls: {
      bucketDir: (bucket: string, key: string) => `/bucket/${bucket}/tree/${key}`,
      bucketFile: (bucket: string, key: string) => `/bucket/${bucket}/file/${key}`,
      bucketPackageTree: (bucket: string, name: string, hash: string, key: string) =>
        `/package/${bucket}/${name}/${hash}/tree/${key}`,
    },
  }),
}))

interface TestWrapperProps {
  children: React.ReactNode
  initialSelection?: any[]
}

// Test component that allows setting up initial selection state
function TestWrapper({ children, initialSelection }: TestWrapperProps) {
  return (
    <MemoryRouter>
      <Provider>
        <SelectionSetup initialSelection={initialSelection} />
        {children}
      </Provider>
    </MemoryRouter>
  )
}

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

describe('containers/Bucket/Selection/Dashboard', () => {
  it.skip('should render empty state when no selection', () => {
    const { container } = render(
      <TestWrapper>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(container).toMatchSnapshot()
  })

  it('should render with single file selection', () => {
    const initialSelection = [
      {
        items: [{ logicalKey: 'document.txt' }],
        bucket: 'test-bucket',
        path: 'files/',
      },
    ]

    const { container } = render(
      <TestWrapper initialSelection={initialSelection}>
        <Dashboard onClose={jest.fn()} />
      </TestWrapper>,
    )

    expect(container).toMatchSnapshot()
  })

  // it.skip('should render with multiple files in single directory', () => {
  //   const initialSelection = [
  //     {
  //       items: [
  //         { logicalKey: 'document1.txt' },
  //         { logicalKey: 'document2.pdf' },
  //         { logicalKey: 'subfolder/nested.json' },
  //       ],
  //       bucket: 'my-bucket',
  //       path: 'data/',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })

  // it.skip('should render with files from multiple directories', () => {
  //   const initialSelection = [
  //     {
  //       items: [{ logicalKey: 'file1.txt' }, { logicalKey: 'file2.txt' }],
  //       bucket: 'bucket-a',
  //       path: 'dir1/',
  //     },
  //     {
  //       items: [{ logicalKey: 'config.json' }],
  //       bucket: 'bucket-b',
  //       path: 'config/',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })

  // it.skip('should render with directory selection', () => {
  //   const initialSelection = [
  //     {
  //       items: [{ logicalKey: 'images/' }, { logicalKey: 'documents/' }],
  //       bucket: 'media-bucket',
  //       path: '',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })

  // it.skip('should render with package handle', () => {
  //   const packageHandle = {
  //     bucket: 'package-bucket',
  //     name: 'my-package',
  //     hash: 'abc123def456',
  //   }

  //   const initialSelection = [
  //     {
  //       items: [{ logicalKey: 'data.csv' }, { logicalKey: 'metadata.json' }],
  //       bucket: 'package-bucket',
  //       path: 'dataset/',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} packageHandle={packageHandle} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })

  // it.skip('should render with mixed file types and directories', () => {
  //   const initialSelection = [
  //     {
  //       items: [
  //         { logicalKey: 'README.md' },
  //         { logicalKey: 'src/' },
  //         { logicalKey: 'package.json' },
  //         { logicalKey: 'tests/' },
  //         { logicalKey: 'build/output.js' },
  //       ],
  //       bucket: 'project-bucket',
  //       path: '',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })

  // it.skip('should render with filtered selection', () => {
  //   const initialSelection = [
  //     {
  //       items: [{ logicalKey: 'logs/error.log' }, { logicalKey: 'logs/access.log' }],
  //       bucket: 'app-bucket',
  //       path: 'application/',
  //       filter: 'logs/',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })

  // it.skip('should render without bookmarks when package handle is present', () => {
  //   const packageHandle = {
  //     bucket: 'no-bookmark-bucket',
  //     name: 'test-package',
  //     hash: 'xyz789abc123',
  //   }

  //   const initialSelection = [
  //     {
  //       items: [{ logicalKey: 'data.txt' }],
  //       bucket: 'no-bookmark-bucket',
  //       path: '',
  //     },
  //   ]

  //   const { container } = render(
  //     <TestWrapper initialSelection={initialSelection}>
  //       <Dashboard onClose={mockOnClose} packageHandle={packageHandle} />
  //     </TestWrapper>,
  //   )

  //   expect(container).toMatchSnapshot()
  // })
})
