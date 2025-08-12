import * as React from 'react'
import { act, create } from 'react-test-renderer'

import DatesRange from './DatesRange'

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

describe('components/Filters/DatesRange', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders with a valid date', () => {
    const renderer = create(
      <DatesRange
        value={{ gte: new Date(2025, 0, 13), lte: null }}
        extents={{}}
        onChange={onChange}
      />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('2025-01-13')
  })

  it('updates value when value changes', () => {
    const renderer = create(
      <DatesRange
        value={{ gte: new Date(2025, 0, 13), lte: null }}
        extents={{}}
        onChange={onChange}
      />,
    )

    const inputInitial = findGteInput(renderer)
    expect(inputInitial.props.value).toBe('2025-01-13')

    act(() => {
      renderer.update(
        <DatesRange
          value={{ gte: new Date(2025, 6, 15), lte: null }}
          extents={{}}
          onChange={onChange}
        />,
      )
    })

    const inputChanged = findGteInput(renderer)
    expect(inputChanged.props.value).toBe('2025-07-15')
  })

  it('sets min/max from extents', () => {
    const min = new Date(2020, 0, 1)
    const max = new Date(2030, 11, 31)

    const renderer = create(
      <DatesRange
        value={{ gte: new Date(2025, 0, 13), lte: null }}
        extents={{ min, max }}
        onChange={onChange}
      />,
    )

    const input = findGteInput(renderer)
    expect(input.props.min).toBe('2020-01-01')
    expect(input.props.max).toBe('2030-12-31')
  })

  it('handles null/undefined extents gracefully', () => {
    const renderer = create(
      <DatesRange
        value={{ gte: new Date(2025, 0, 13), lte: null }}
        extents={{}}
        onChange={onChange}
      />,
    )

    const input = findGteInput(renderer)
    expect(input.props.min).toBeUndefined()
    expect(input.props.max).toBeUndefined()
  })

  it('shows empty value when date is null', () => {
    const renderer = create(
      <DatesRange value={{ gte: null, lte: null }} extents={{}} onChange={onChange} />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('')
  })

  it('shows empty value and error when date is invalid', () => {
    const renderer = create(
      <DatesRange
        value={{ gte: new Date('I XIII MMXXV'), lte: null }}
        extents={{}}
        onChange={onChange}
      />,
    )
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('')
    expect(input.props['data-error']).toBe('Invalid time value')
  })

  it('shows error when clear the date', () => {
    const renderer = create(
      <DatesRange
        value={{ gte: new Date(2025, 0, 13), lte: null }}
        extents={{}}
        onChange={onChange}
      />,
    )

    const inputInitial = findGteInput(renderer)
    expect(inputInitial.props.value).toBe('2025-01-13')

    act(() => {
      renderer.update(
        <DatesRange value={{ gte: null, lte: null }} extents={{}} onChange={onChange} />,
      )
    })

    const inputChanged = findGteInput(renderer)
    expect(inputChanged.props.value).toBe('')
    expect(inputChanged.props['data-error']).toBe('Empty date')
  })

  it('resets error when date is fine', () => {
    const renderer = create(
      <DatesRange
        value={{ gte: new Date('I XIII MMXXV'), lte: null }}
        extents={{}}
        onChange={onChange}
      />,
    )
    const inputInitial = findGteInput(renderer)
    expect(inputInitial.props.value).toBe('')
    expect(inputInitial.props['data-error']).toBe('Invalid time value')

    act(() => {
      renderer.update(
        <DatesRange
          value={{ gte: new Date(2025, 0, 13), lte: null }}
          extents={{}}
          onChange={onChange}
        />,
      )
    })

    const inputChanged = findGteInput(renderer)
    expect(inputChanged.props.value).toBe('2025-01-13')
    expect(inputChanged.props['data-error']).toBeFalsy()
  })

  it('does not trigger an extra render when updating with the same Date instance', () => {
    const { TextField } = require('@material-ui/core') as {
      TextField: jest.Mock
    }
    const date = new Date(2025, 0, 13)

    // Initial render called once (but 2 TextFields)
    const renderer = create(
      <DatesRange value={{ gte: date, lte: null }} extents={{}} onChange={onChange} />,
    )
    expect(TextField).toHaveBeenCalledTimes(2)

    // Only the parent update render should occur (no extra render from state change)
    TextField.mockClear()
    act(() => {
      renderer.update(
        <DatesRange value={{ gte: date, lte: null }} extents={{}} onChange={onChange} />,
      )
    })
    expect(TextField).toHaveBeenCalledTimes(2)

    // And the value stays the same, no error text
    const input = findGteInput(renderer)
    expect(input.props.value).toBe('2025-01-13')
    expect(input.props['data-error']).toBeFalsy()

    // One render for the prop change (2 TextFields) + one more due to state update from effect
    TextField.mockClear()
    act(() => {
      renderer.update(
        <DatesRange
          value={{ gte: new Date(2025, 0, 13), lte: null }}
          extents={{}}
          onChange={onChange}
        />,
      )
    })
    expect(TextField).toHaveBeenCalledTimes(3)
  })
})
