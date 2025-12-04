import * as React from 'react'
import { render } from '@testing-library/react'
import { createMuiTheme } from '@material-ui/core'
import { describe, it, expect, vi } from 'vitest'

import BucketPreferences from './BucketPreferences'

const theme = createMuiTheme()
const noop = () => {}

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/BucketConfig', () => ({
  useRelevantBucketConfigs: () => [],
}))

vi.mock('@material-ui/core', async () => {
  const actual = await vi.importActual('@material-ui/core')
  return {
    ...actual,
    Checkbox: ({ checked }: { checked: boolean }) => (
      <div id="checkbox">{checked.toString()}</div>
    ),
    IconButton: ({ children }: { children: React.ReactNode }) => (
      <div id="icon-button">{children}</div>
    ),
    Icon: ({ children }: { children: string }) => <div id="icon">{children}</div>,
    TextField: ({ value }: { value: React.ReactNode }) => (
      <div id="text-field">{value}</div>
    ),
    Select: ({ value }: { value: string }) => <div id="select">{value}</div>,
    makeStyles: (cb: any) => () => {
      const classes = typeof cb === 'function' ? cb(theme) : cb
      return Object.keys(classes).reduce(
        (acc, key) => ({
          [key]: key,
          ...acc,
        }),
        {},
      )
    },
  }
})

vi.mock('@material-ui/lab', async () => {
  const actual = await vi.importActual('@material-ui/lab')
  return {
    ...actual,
    Autocomplete: ({ options, value }: { options?: string[]; value: string }) => (
      <div id="autocomplete">
        {value} from [{options?.join(', ')}]
      </div>
    ),
  }
})

describe('components/FileEditor/QuiltConfigEditor/BucketPreferences/BucketPreferences', () => {
  it('render form with default values', () => {
    const { container } = render(
      <BucketPreferences
        className="root"
        error={null}
        handle={{ bucket: 'test-bucket', key: 'any' }}
        onChange={noop}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
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
    const { container } = render(
      <BucketPreferences
        initialValue={config}
        className="root"
        error={null}
        onChange={noop}
        handle={{ bucket: 'test-bucket', key: 'any' }}
      />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
