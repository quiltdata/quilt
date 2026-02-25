import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

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
  deleteObject: true,
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

vi.mock('utils/BucketCache', () => ({
  useBucketExistence: () => ({
    case: (cases: Record<string, Function>) => cases.Ok(),
  }),
}))

vi.mock('react-redux', () => ({
  useSelector: vi.fn(() => ({ token: 'ABC' })),
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
  afterEach(cleanup)

  describe('RowActions', () => {
    it('should render nothing if archived', () => {
      const { container } = render(
        <TestBucket>
          <RowActions archived to="" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toBe(null)
    })

    it('should render nothing if no route', () => {
      const { container } = render(
        <TestBucket>
          <RowActions to="" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toBe(null)
    })

    it('should render nothing if wrong route', () => {
      const { container } = render(
        <TestBucket>
          <RowActions to="/b/bucketA/BRANCH/fileB" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(container.firstChild).toBe(null)
    })

    it('should render Bucket directory', () => {
      const { getByTitle, getByDisplayValue } = render(
        <TestBucket>
          <RowActions to="/b/bucketA/tree/dirB/" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(getByTitle('Delete')).toBeTruthy()
      expect(getByTitle('Bookmark')).toBeTruthy()
      expect(getByTitle('Download')).toBeTruthy()
      const tokenInput = getByDisplayValue('ABC')
      const form = tokenInput.closest('form')
      expect(form).toBeTruthy()
      expect(form?.getAttribute('action')).toBe('/zip/dir/bucketA/dirB/')
      expect(form?.getAttribute('method')).toBe('POST')
    })

    it('should render Bucket file', () => {
      const { getByTitle } = render(
        <TestBucket>
          <RowActions to="/b/bucketA/tree/fileB" prefs={defaultPrefs} onReload={noop} />
        </TestBucket>,
      )
      expect(getByTitle('Delete')).toBeTruthy()
      expect(getByTitle('Bookmark')).toBeTruthy()
      const downloadLink = getByTitle('Download')
      expect(downloadLink).toBeTruthy()
      expect(downloadLink.getAttribute('href')).toBe('s3://bucketA/fileB')
      expect(downloadLink.getAttribute('download')).toBe('')
    })

    it('should render Package directory', () => {
      const { getByTitle, getByDisplayValue } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/packages/namespaceB/nameC/tree/latest/dirD/"
            prefs={defaultPrefs}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(getByTitle('Download')).toBeTruthy()
      const tokenInput = getByDisplayValue('ABC')
      const form = tokenInput.closest('form')
      expect(form).toBeTruthy()
      expect(form?.getAttribute('action')).toBe(
        '/zip/package/bucketA/namespaceB/nameC/latest/dirD/',
      )
      expect(form?.getAttribute('method')).toBe('POST')
    })

    it('should render Package file', () => {
      const { getByTitle } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/packages/namespaceB/nameC/tree/latest/fileD"
            physicalKey="s3://bucketA/pathB/fileB"
            prefs={defaultPrefs}
            onReload={noop}
          />
        </TestBucket>,
      )
      const downloadLink = getByTitle('Download')
      expect(downloadLink).toBeTruthy()
      expect(downloadLink.getAttribute('href')).toBe('s3://bucketa/pathB/fileB')
      expect(downloadLink.getAttribute('download')).toBe('')
    })

    it('should render Bucket file without download button', () => {
      const { getByTitle, queryByTitle } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/tree/fileB"
            prefs={{ ...defaultPrefs, downloadObject: false }}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(getByTitle('Delete')).toBeTruthy()
      expect(getByTitle('Bookmark')).toBeTruthy()
      expect(queryByTitle('Download')).toBeFalsy()
    })

    it('should render Bucket file without delete button', () => {
      const { queryByTitle, getByTitle } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/tree/fileB"
            prefs={{ ...defaultPrefs, deleteObject: false }}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(queryByTitle('Delete')).toBeFalsy()
      expect(getByTitle('Bookmark')).toBeTruthy()
      expect(getByTitle('Download')).toBeTruthy()
    })

    it('should render Bucket directory without delete button', () => {
      const { queryByTitle, getByTitle } = render(
        <TestBucket>
          <RowActions
            to="/b/bucketA/tree/dirB/"
            prefs={{ ...defaultPrefs, deleteObject: false }}
            onReload={noop}
          />
        </TestBucket>,
      )
      expect(queryByTitle('Delete')).toBeFalsy()
      expect(getByTitle('Bookmark')).toBeTruthy()
      expect(getByTitle('Download')).toBeTruthy()
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
      expect(container.firstChild).toBe(null)
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
      expect(container.firstChild).toBe(null)
    })
  })
})
