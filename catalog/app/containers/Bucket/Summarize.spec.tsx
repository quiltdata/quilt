import * as React from 'react'
import renderer from 'react-test-renderer'

import { ConfigureAppearance } from './Summarize'

jest.mock(
  '@material-ui/core',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    Button: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div id="button">{children}</div>
    )),
    Tooltip: jest.fn(
      ({ title, children }: React.PropsWithChildren<{ title: React.ReactNode }>) => (
        <div>
          {title}
          <hr />
          {children}
        </div>
      ),
    ),
  })),
)

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock(
  'components/Preview',
  jest.fn(() => ({})),
)
jest.mock(
  'components/Preview/loaders/summarize',
  jest.fn(() => ({})),
)
jest.mock(
  './requests',
  jest.fn(() => ({})),
)
jest.mock(
  './errors',
  jest.fn(() => ({})),
)
jest.mock(
  'components/Markdown',
  jest.fn(() => ({})),
)
jest.mock(
  'components/FileEditor/FileEditor',
  jest.fn(() => ({})),
)

jest.mock('utils/NamedRoutes', () => ({
  ...jest.requireActual('utils/NamedRoutes'),
  use: jest.fn(() => ({
    urls: {
      bucketPackageDetail: (b: string, n: string, opts: any) =>
        `package: ${b}/${n} ${JSON.stringify(opts)}`,
      bucketFile: (b: string, k: string, opts: any) =>
        `file: ${b}/${k} ${JSON.stringify(opts)}`,
    },
  })),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn(({ to, children }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to}>{children}</a>
  )),
}))

describe('containers/Buckets/Summarize', () => {
  describe('ConfigureAppearance', () => {
    const packageHandle = { bucket: 'b', name: 'n', hash: 'h' }

    it('should not render buttons when there are files out there', () => {
      const tree = renderer
        .create(
          <ConfigureAppearance
            hasReadme
            hasSummarizeJson
            packageHandle={packageHandle}
            path=""
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render readme link', () => {
      const tree = renderer
        .create(
          <ConfigureAppearance
            hasReadme={false}
            hasSummarizeJson
            packageHandle={packageHandle}
            path=""
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render quilt_summarize link', () => {
      const tree = renderer
        .create(
          <ConfigureAppearance
            hasReadme
            hasSummarizeJson={false}
            packageHandle={packageHandle}
            path=""
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('should render both links', () => {
      const tree = renderer
        .create(
          <ConfigureAppearance
            hasReadme={false}
            hasSummarizeJson={false}
            packageHandle={packageHandle}
            path="some/path"
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
})
