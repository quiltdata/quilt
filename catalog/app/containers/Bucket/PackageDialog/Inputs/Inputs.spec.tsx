import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import noop from 'utils/noop'

import Message from './Message'
import Name from './Name'

describe('containers/Bucket/PackageDialog/Inputs', () => {
  afterEach(cleanup)

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
})
