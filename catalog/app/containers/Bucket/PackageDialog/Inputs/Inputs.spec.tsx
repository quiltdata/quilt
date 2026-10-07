import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/FileEditor/HelpLinks', () => ({
  FlowsLink: ({ children }: React.PropsWithChildren<{}>) => children,
  WorkflowsConfigLink: ({ children }: React.PropsWithChildren<{}>) => children,
}))

import noop from 'utils/noop'
import * as workflows from 'utils/workflows'

import Message from './Message'
import Name from './Name'
import Workflow from './Workflow'

describe('containers/Bucket/PackageDialog/Inputs', () => {
  it('labels the name field', () => {
    const { getByLabelText } = render(
      <Name
        formStatus={{ _tag: 'ready' }}
        state={{ value: '', status: { _tag: 'new' }, onChange: noop, resetDirty: noop }}
        setSrc={noop}
      />,
    )
    expect(getByLabelText('Name').tagName).toBe('INPUT')
  })

  it('labels the message field', () => {
    const { getByLabelText } = render(
      <Message
        formStatus={{ _tag: 'ready' }}
        state={{ value: '', status: { _tag: 'ok' }, onChange: noop }}
      />,
    )
    expect(getByLabelText('Message').tagName).toBe('INPUT')
  })

  it('names the flow select by its label and value', () => {
    const wf = {
      name: 'Standard',
      slug: 'standard',
      isDisabled: false,
    } as workflows.Workflow
    const { getByRole } = render(
      <Workflow
        bucket="b"
        formStatus={{ _tag: 'ready' }}
        schema={{ _tag: 'ready' } as React.ComponentProps<typeof Workflow>['schema']}
        state={{ value: wf, status: { _tag: 'ok' }, onChange: noop }}
        config={
          {
            _tag: 'ready',
            config: { workflows: [wf, { ...wf, slug: 'other' }] },
          } as React.ComponentProps<typeof Workflow>['config']
        }
      />,
    )
    expect(getByRole('button', { name: 'Flow Standard' })).toBeTruthy()
  })
})
