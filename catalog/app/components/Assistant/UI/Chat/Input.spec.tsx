import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import noop from 'utils/noop'

import Input from './Input'

describe('components/Assistant/UI/Chat/Input', () => {
  it('labels the chat field', () => {
    const { getByRole } = render(<Input onSubmit={noop} />)
    expect(getByRole('textbox', { name: 'Ask Qurator' })).toBeTruthy()
  })
})
