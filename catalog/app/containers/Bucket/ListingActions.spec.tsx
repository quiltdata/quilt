import * as React from 'react'
import renderer from 'react-test-renderer'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Bookmarks from 'containers/Bookmarks/Provider'
import { bucketFile, bucketDir, bucketPackageTree } from 'constants/routes'

import RowActions from './ListingActions'

jest.mock(
  'constants/config',
  jest.fn(() => ({
    noDownload: false,
    s3Proxy: '',
  })),
)

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

const noop = () => {}

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
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions archived to="" prefs={defaultPrefs} onReload={noop} />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render nothing if no route', () => {
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions to="" prefs={defaultPrefs} onReload={noop} />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render nothing if wrong route', () => {
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions
              to="/b/bucketA/BRANCH/fileB"
              prefs={defaultPrefs}
              onReload={noop}
            />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Bucket directory', () => {
      jest.mock('react-redux')
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions to="/b/bucketA/tree/dirB/" prefs={defaultPrefs} onReload={noop} />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Bucket file', () => {
      jest.mock('utils/AWS')
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions to="/b/bucketA/tree/fileB" prefs={defaultPrefs} onReload={noop} />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Package directory', () => {
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions
              to="/b/bucketA/packages/namespaceB/nameC/tree/latest/dirD/"
              prefs={defaultPrefs}
              onReload={noop}
            />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Package file', () => {
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions
              to="/b/bucketA/packages/namespaceB/nameC/tree/latest/fileD"
              physicalKey="s3://bucketA/pathB/fileB"
              prefs={defaultPrefs}
              onReload={noop}
            />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Bucket file without download button', () => {
      jest.mock('utils/AWS')
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions
              to="/b/bucketA/tree/fileB"
              prefs={{ ...defaultPrefs, downloadObject: false }}
              onReload={noop}
            />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Package directory without download button', () => {
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions
              to="/b/bucketA/packages/namespaceB/nameC/tree/latest/dirD/"
              prefs={{ ...defaultPrefs, downloadPackage: false }}
              onReload={noop}
            />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render Package file without download button', () => {
      const tree = renderer
        .create(
          <TestBucket>
            <RowActions
              to="/b/bucketA/packages/namespaceB/nameC/tree/latest/fileD"
              physicalKey="s3://bucketA/pathB/fileB"
              prefs={{ ...defaultPrefs, downloadPackage: false }}
              onReload={noop}
            />
          </TestBucket>,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
})
