import * as React from 'react'
import renderer from 'react-test-renderer'
import { createMuiTheme } from '@material-ui/core'

import BucketPreferences from './BucketPreferences'

const theme = createMuiTheme()
const noop = () => {}

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock(
  'utils/BucketConfig',
  jest.fn(() => ({
    useRelevantBucketConfigs: () => [],
  })),
)

jest.mock(
  '@material-ui/core',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    Checkbox: jest.fn(({ checked }: { checked: boolean }) => (
      <div id="checkbox">{checked.toString()}</div>
    )),
    IconButton: jest.fn(({ children }: { children: React.ReactNode }) => (
      <div id="icon-button">{children}</div>
    )),
    Icon: jest.fn(({ children }: { children: string }) => (
      <div id="icon">{children}</div>
    )),
    TextField: jest.fn(({ value }: { value: React.ReactNode }) => (
      <div id="text-field">{value}</div>
    )),
    Select: jest.fn(({ value }: { value: string }) => <div id="select">{value}</div>),
    makeStyles: jest.fn((cb: any) => () => {
      const classes = typeof cb === 'function' ? cb(theme) : cb
      return Object.keys(classes).reduce(
        (acc, key) => ({
          [key]: key,
          ...acc,
        }),
        {},
      )
    }),
  })),
)

jest.mock(
  '@material-ui/lab',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    Autocomplete: jest.fn(({ options, value }: { options?: string[]; value: string }) => (
      <div id="autocomplete">
        {value} from [{options?.join(', ')}]
      </div>
    )),
  })),
)

describe('components/FileEditor/QuiltConfigEditor/BucketPreferences/BucketPreferences', () => {
  it('render form with default values', () => {
    const tree = renderer
      .create(<BucketPreferences className="root" error={null} onChange={noop} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('render form config where every value is custom', () => {
    const config = `ui:
  actions:
    copyPackage: false
    createPackage: false
    deleteRevision: true
    downloadObject: false
    downloadPackage: false
    openInDesktop: true
    revisePackage: false
    writeFile: false
  blocks:
    analytics: false
    browser: false
    code: false
    meta:
      user_meta:
        expanded: 2
      workflows:
        expanded: 3
    gallery:
      files: false
      overview: false
      packages: false
      summarize: false
    qurator: false
  nav:
    files: false
    workflows: false
    packages: false
    queries: false
  sourceBuckets:
    s3://a: {}
    s3://b: {}
    s3://c: {}
  defaultSourceBucket: s3://b
  package_description:
    ^prefix/namespace$:
      message: false
      user_meta:
        - $.Some.Key
        - $.Another.Key
  package_description_multiline: true
  athena:
    defaultWorkgroup: Foo
`
    const tree = renderer
      .create(
        <BucketPreferences
          initialValue={config}
          className="root"
          error={null}
          onChange={noop}
        />,
      )
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
