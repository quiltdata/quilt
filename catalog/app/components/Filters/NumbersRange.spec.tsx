import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import NumbersRange from './NumbersRange'

vi.mock('./Slider', () => ({
  default: ({ min, max }: { min: number; max: number }) => (
    <div data-min={min} data-max={max} />
  ),
}))

vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  TextField: vi.fn(
    ({
      helperText,
      inputProps: { min, max } = {},
      onChange,
      value,
    }: {
      helperText?: string
      inputProps?: { min?: string; max?: string }
      onChange: () => void
      value: string
    }) => (
      <input
        data-error={helperText}
        max={max}
        min={min}
        onChange={onChange}
        value={value}
      />
    ),
  ),
}))

vi.mock('utils/Logging', () => ({
  default: { error: vi.fn() },
}))

const onChange = vi.fn()
const findGteInput = (container: HTMLElement) => container.querySelector('input')!

describe('components/Filters/NumbersRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with a valid number', () => {
    const { container } = render(
      <NumbersRange value={{ gte: 42, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(container)
    expect(input.value).toBe('42')
    expect(input.getAttribute('data-error')).toBeFalsy()
  })

  it('updates value when value changes', () => {
    const { container, rerender } = render(
      <NumbersRange value={{ gte: 13, lte: null }} extents={{}} onChange={onChange} />,
    )
    expect(findGteInput(container).value).toBe('13')

    rerender(
      <NumbersRange value={{ gte: 15, lte: null }} extents={{}} onChange={onChange} />,
    )
    expect(findGteInput(container).value).toBe('15')
  })

  it('sets min/max from extents', () => {
    const { container } = render(
      <NumbersRange
        value={{ gte: 10, lte: null }}
        extents={{ min: 1, max: 100 }}
        onChange={onChange}
      />,
    )
    const input = findGteInput(container)
    expect(input.min).toBe('1')
    expect(input.max).toBe('100')
  })

  it('handles null/undefined extents gracefully', () => {
    const { container } = render(
      <NumbersRange value={{ gte: 10, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(container)
    expect(input.min).toBe('')
    expect(input.max).toBe('')
  })

  it('shows empty value when number is null', () => {
    const { container } = render(
      <NumbersRange value={{ gte: null, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(container)
    expect(input.value).toBe('')
    expect(input.getAttribute('data-error')).toBe('Enter number, please')
  })

  it('handles zero correctly', () => {
    const { container } = render(
      <NumbersRange value={{ gte: 0, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(container)
    expect(input.value).toBe('0')
    expect(input.getAttribute('data-error')).toBeFalsy()
  })

  it('treats NaN as invalid', () => {
    const { container } = render(
      <NumbersRange
        // @ts-expect-error
        value={{ gte: 'abc', lte: 'def' }}
        extents={{}}
        onChange={onChange}
      />,
    )
    const input = findGteInput(container)
    expect(input.value).toBe('')
    expect(input.getAttribute('data-error')).toBe('Not a number')
  })
})
