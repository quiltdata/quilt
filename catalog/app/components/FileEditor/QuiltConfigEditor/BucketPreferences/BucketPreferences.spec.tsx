import * as React from 'react'
import renderer from 'react-test-renderer'
// import { createMuiTheme } from '@material-ui/core'

import BucketPreferences from './BucketPreferences'

// const theme = createMuiTheme()
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
      <div id="checkbox">{checked}</div>
    )),
    TextField: jest.fn(({ value }: { value: React.ReactNode }) => (
      <div id="text-field">{value}</div>
    )),
    Select: jest.fn(({ options, value }: { options?: string[]; value: string }) => (
      <div id="select">
        {value} from [{options?.join(', ')}]
      </div>
    )),
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
})
