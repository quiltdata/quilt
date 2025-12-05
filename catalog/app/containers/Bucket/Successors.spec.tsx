import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import type { Successor } from 'utils/workflows'
import noop from 'utils/noop'

import { SuccessorsSelect } from './Successors'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  Menu: ({ children }: React.PropsWithChildren<{}>) => (
    <ul data-testid="menu">{children}</ul>
  ),
  MenuItem: ({ children }: React.PropsWithChildren<{}>) => <li>{children}</li>,
  ListItemText: ({ primary, secondary }: { primary: string; secondary?: string }) => (
    <span title={secondary}>{primary}</span>
  ),
  ListSubheader: ({ children }: React.PropsWithChildren<{}>) => <h1>{children}</h1>,
  Popover: ({ children }: React.PropsWithChildren<{}>) => <div>{children}</div>,
}))

vi.mock('@material-ui/lab', () => ({
  Skeleton: () => <div>Loading…</div>,
}))

vi.mock('components/FileEditor/HelpLinks', () => ({
  WorkflowsConfigLink: ({ children }: React.PropsWithChildren<{}>) => <a>{children}</a>,
}))

vi.mock('utils/StyledLink', () => ({
  default: ({ children, ...props }: React.PropsWithChildren<any>) => (
    <a {...props}>{children}</a>
  ),
}))

const props = {
  anchorEl: document.createElement('div'),
  onChange: noop,
  onClose: noop,
}

describe('containers/Bucket/Successors/SuccessorsSelect', () => {
  it('should render loading state', () => {
    const { container } = render(<SuccessorsSelect {...props} successors={undefined} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render error state', () => {
    const { container } = render(
      <SuccessorsSelect {...props} successors={new Error('Test error')} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render empty state', () => {
    const { container } = render(<SuccessorsSelect {...props} successors={[]} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should render populated state', () => {
    const successors: Successor[] = [
      { slug: 'bucket1', name: 'Bucket One', url: 's3://bucket1', copyData: true },
      { slug: 'bucket2', name: 'bucket2', url: 's3://bucket2', copyData: false },
    ]

    const { container } = render(<SuccessorsSelect {...props} successors={successors} />)
    expect(container.firstChild).toMatchSnapshot()
  })
})
