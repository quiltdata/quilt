import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type * as Model from 'model'
import { bucketFile, bucketDir, bucketPackageTree } from 'constants/routes'
import * as Bookmarks from 'containers/Bookmarks/Provider'
import * as NamedRoutes from 'utils/NamedRoutes'
import noop from 'utils/noop'

import RowActions from './ListingActions'

vi.mock('constants/config', () => ({
  default: {
    noDownload: false,
    s3Proxy: '',
  },
}))

const defaultPrefs = {
  copyPackage: true,
  createPackage: true,
  deleteRevision: true,
  downloadObject: true,
  downloadPackage: true,
  openInDesktop: true,
  revisePackage: true,
  writeFile: true,
}

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  IconButton: ({ onClick, ...props }: any) =>
    props.href ? <a {...props} /> : <button {...props} />,
}))

vi.mock('@material-ui/icons', () => ({
  ArrowDownwardOutlined: () => <span>arrow_downward</span>,
  DeleteOutlined: () => <span>delete</span>,
  TurnedInOutlined: () => <span>turned_in</span>,
  TurnedInNotOutlined: () => <span>turned_in_not</span>,
}))

vi.mock('containers/Notifications', () => ({
  use: () => ({
    push: noop,
  }),
}))

vi.mock('utils/AWS', () => ({
  S3: {
    use: () => null,
  },
  Signer: {
    useDownloadUrl: (h: Model.S3.S3ObjectLocation) => `s3://${h.bucket}/${h.key}`,
  },
}))

vi.mock('react-redux', () => ({
  useSelector: vi.fn(() => ({ token: 'mock-token' })),
}))

function TestBucket({ children }: React.PropsWithChildren<{}>) {
  return (
    <Bookmarks.Provider>
      <NamedRoutes.Provider routes={{ bucketFile, bucketDir, bucketPackageTree }}>
        {children}
      </NamedRoutes.Provider>
    </Bookmarks.Provider>
  )
}

describe('components/ListingActions', () => {
  describe('RowActions', () => {
    it('should render nothing if archived', () => {
      const { container } = render(
        <TestBucket>
          <RowActions archived to="" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render nothing if no route', () => {
      const { container } = render(
        <TestBucket>
          <RowActions to="" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render nothing if wrong route', () => {
      const { container } = render(
        <TestBucket>
          <RowActions to="/b/bucketA/BRANCH/fileB" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Bucket directory', () => {
      const { container } = render(
        <TestBucket>
          <RowActions to="/b/bucketA/tree/dirB/" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Bucket file', () => {
      const { container } = render(
        <TestBucket>
          <RowActions to="/b/bucketA/tree/fileB" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Package directory', () => {
      const { container } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/packages/namespaceB/nameC/tree/latest/dirD/"
            prefs={defaultPrefs}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Package file', () => {
      const { container } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/packages/namespaceB/nameC/tree/latest/fileD"
            physicalKey="s3://bucketA/pathB/fileB"
            prefs={defaultPrefs}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Bucket file without download button', () => {
      const { container } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/tree/fileB"
            prefs={{ ...defaultPrefs, downloadObject: false }}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Package directory without download button', () => {
      const { container } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/packages/namespaceB/nameC/tree/latest/dirD/"
            prefs={{ ...defaultPrefs, downloadPackage: false }}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('should render Package file without download button', () => {
      const { container } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/packages/namespaceB/nameC/tree/latest/fileD"
            physicalKey="s3://bucketA/pathB/fileB"
            prefs={{ ...defaultPrefs, downloadPackage: false }}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})
