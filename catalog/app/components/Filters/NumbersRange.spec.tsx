import * as React from 'react'
import { act, create } from 'react-test-renderer'

import NumbersRange from './NumbersRange'

jest.mock(
  './Slider',
  jest.fn(() => ({ min, max }: { min: number; max: number }) => (
    <div data-min={min} data-max={max} />
  )),
)

jest.mock(
  '@material-ui/core',
  jest.fn(() => ({
    ...jest.requireActual('@material-ui/core'),
    TextField: jest.fn(
      ({
        value,
        inputProps: { min, max } = {},
        helperText,
      }: {
        value: string
        inputProps?: { min?: string; max?: string }
        helperText?: string
      }) => <input value={value} min={min} max={max} data-error={helperText} />,
    ),
  })),
)

jest.mock('utils/Logging', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}))

const onChange = jest.fn()
const findGteInput = (tree: any) => tree.root.findAllByType('input')[0]

describe('components/Filters/NumbersRange', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with a valid number', () => {
    const renderer = create(
      <NumbersRange value={{ gte: 42, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('42')
    expect(input.props['data-error']).toBeFalsy()
  })

  it('updates value when value changes', () => {
    const renderer = create(
      <NumbersRange value={{ gte: 13, lte: null }} extents={{}} onChange={onChange} />,
    )
    expect(findGteInput(renderer).props.value).toBe('13')

    act(() => {
      renderer.update(
        <NumbersRange value={{ gte: 15, lte: null }} extents={{}} onChange={onChange} />,
      )
    })
    expect(findGteInput(renderer).props.value).toBe('15')
  })

  it('sets min/max from extents', () => {
    const renderer = create(
      <NumbersRange
        value={{ gte: 10, lte: null }}
        extents={{ min: 1, max: 100 }}
        onChange={onChange}
      />,
    )
    const input = findGteInput(renderer)
    expect(input.props.min).toBe('1')
    expect(input.props.max).toBe('100')
  })

  it('handles null/undefined extents gracefully', () => {
    const renderer = create(
      <NumbersRange value={{ gte: 10, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(renderer)
    expect(input.props.min).toBeUndefined()
    expect(input.props.max).toBeUndefined()
  })

  it('shows empty value when number is null', () => {
    const renderer = create(
      <NumbersRange value={{ gte: null, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('')
    expect(input.props['data-error']).toBe('Enter number, please')
  })

  it('handles zero correctly', () => {
    const renderer = create(
      <NumbersRange value={{ gte: 0, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('0')
    expect(input.props['data-error']).toBeFalsy()
  })

  it('treats NaN as invalid', () => {
    const renderer = create(
      <NumbersRange
        // @ts-expect-error
        value={{ gte: 'abc', lte: 'def' }}
        extents={{}}
        onChange={onChange}
      />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('')
    expect(input.props['data-error']).toBe('Not a number')
  })
})
