import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'

import QuiltSummarize from './QuiltSummarize'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: () => ({ bucket: 'b', key: 'k' }),
  useLocation: () => ({ search: '?edit=true' }),
}))

vi.mock('utils/GlobalDialogs', () => ({ use: () => noop }))

// An extended entry, so the advanced panel with Expand and Renderer is open.
const initialValue = JSON.stringify([{ path: 'foo.md', title: 'Foo' }])

function toggleExpand(disabled: boolean) {
  const onChange = vi.fn()
  const { getByLabelText } = render(
    <QuiltSummarize
      disabled={disabled}
      error={null}
      initialValue={initialValue}
      onChange={onChange}
    />,
  )
  act(() => {
    vi.runAllTimers()
  })
  onChange.mockClear()
  fireEvent.click(getByLabelText('Expand'))
  act(() => {
    vi.runAllTimers()
  })
  return onChange
}

describe('components/FileEditor/QuiltConfigEditor/QuiltSummarize disabled', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('applies Expand when enabled', () => {
    expect(toggleExpand(false)).toHaveBeenCalledWith(expect.stringContaining('expand'))
  })

  it('ignores Expand when disabled', () => {
    expect(toggleExpand(true)).not.toHaveBeenCalled()
  })
})
