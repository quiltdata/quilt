import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import noop from 'utils/noop'

import Input from './Input'

describe('components/Assistant/UI/Chat/Input', () => {
  afterEach(cleanup)

  it('labels the chat field', () => {
    const { getByRole } = render(<Input onSubmit={noop} />)
    expect(getByRole('textbox', { name: 'Ask Qurator' })).toBeTruthy()
  })
})
