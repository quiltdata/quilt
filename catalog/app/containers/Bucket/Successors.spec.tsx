import * as React from 'react'
import renderer from 'react-test-renderer'

import type { Successor } from 'utils/workflows'

import { SuccessorsSelect } from './Successors'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

jest.mock('@material-ui/core', () => ({
  ...jest.requireActual('@material-ui/core'),
  Menu: jest.fn(({ children }: React.PropsWithChildren<{}>) => (
    <ul data-testid="menu">{children}</ul>
  )),
  MenuItem: jest.fn(({ children }: React.PropsWithChildren<{}>) => <li>{children}</li>),
  ListItemText: jest.fn(
    ({ primary, secondary }: { primary: string; secondary?: string }) => (
      <span title={secondary}>{primary}</span>
    ),
  ),
  ListSubheader: jest.fn(({ children }: React.PropsWithChildren<{}>) => (
    <h1>{children}</h1>
  )),
  Popover: jest.fn(({ children }: React.PropsWithChildren<{}>) => <div>{children}</div>),
}))

jest.mock('@material-ui/lab', () => ({
  Skeleton: jest.fn(() => <div>Loading…</div>),
}))

jest.mock('components/FileEditor/HelpLinks', () => ({
  WorkflowsConfigLink: jest.fn(({ children }: React.PropsWithChildren<{}>) => (
    <a>{children}</a>
  )),
}))

const props = {
  anchorEl: document.createElement('div'),
  onChange: jest.fn(),
  onClose: jest.fn(),
}

describe('containers/Bucket/Successors/SuccessorsSelect', () => {
  it('should render loading state', () => {
    const tree = renderer
      .create(<SuccessorsSelect {...props} successors={undefined} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render error state', () => {
    const tree = renderer
      .create(<SuccessorsSelect {...props} successors={new Error('Test error')} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render empty state', () => {
    const tree = renderer.create(<SuccessorsSelect {...props} successors={[]} />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('should render populated state', () => {
    const successors: Successor[] = [
      { slug: 'bucket1', name: 'Bucket One', url: 's3://bucket1', copyData: true },
      { slug: 'bucket2', name: 'bucket2', url: 's3://bucket2', copyData: false },
    ]

    const tree = renderer
      .create(<SuccessorsSelect {...props} successors={successors} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})
