import * as React from 'react'
import { act, create } from 'react-test-renderer'

import DateField from './DateField'

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

const findInput = (tree: any) => tree.root.findByType('input')

describe('DateField', () => {
  it('renders with a valid date prop', () => {
    const renderer = create(
      <DateField date={new Date(2025, 0, 13)} extents={{}} onChange={onChange} />,
    )
    const input = findInput(renderer)
    expect(input.props.value).toBe('2025-01-13')
  })

  it('updates value when prop "date" changes', () => {
    const renderer = create(
      <DateField date={new Date(2025, 0, 13)} extents={{}} onChange={onChange} />,
    )

    const inputInitial = findInput(renderer)
    expect(inputInitial.props.value).toBe('2025-01-13')

    act(() => {
      renderer.update(
        <DateField date={new Date(2025, 6, 15)} extents={{}} onChange={onChange} />,
      )
    })

    const inputChanged = findInput(renderer)
    expect(inputChanged.props.value).toBe('2025-07-15')
  })

  it('sets min/max from extents', () => {
    const min = new Date(2020, 0, 1)
    const max = new Date(2030, 11, 31)

    const renderer = create(
      <DateField
        date={new Date(2025, 0, 13)}
        extents={{ min, max }}
        onChange={onChange}
      />,
    )

    const input = findInput(renderer)
    expect(input.props.min).toBe('2020-01-01')
    expect(input.props.max).toBe('2030-12-31')
  })

  it('handles null/undefined extents gracefully', () => {
    const renderer = create(
      <DateField date={new Date(2025, 0, 13)} extents={{}} onChange={onChange} />,
    )

    const input = findInput(renderer)
    expect(input.props.min).toBeUndefined()
    expect(input.props.max).toBeUndefined()
  })

  it('shows empty value when date is null', () => {
    const renderer = create(<DateField date={null} extents={{}} onChange={onChange} />)
    const input = findInput(renderer)
    expect(input.props.value).toBe('')
  })

  it('shows empty value and error when date is invalid', () => {
    const renderer = create(
      <DateField date={new Date('I XIII MMXXV')} extents={{}} onChange={onChange} />,
    )
    const input = findInput(renderer)
    expect(input.props.value).toBe('')
    expect(input.props['data-error']).toBe('Invalid time value')
  })

  it('shows error when clear the date', () => {
    const renderer = create(
      <DateField date={new Date(2025, 0, 13)} extents={{}} onChange={onChange} />,
    )

    const inputInitial = findInput(renderer)
    expect(inputInitial.props.value).toBe('2025-01-13')

    act(() => {
      renderer.update(<DateField date={null} extents={{}} onChange={onChange} />)
    })

    const inputChanged = findInput(renderer)
    expect(inputChanged.props.value).toBe('')
    expect(inputChanged.props['data-error']).toBe('Empty date')
  })

  it('resets error when date is fine', () => {
    const renderer = create(
      <DateField date={new Date('I XIII MMXXV')} extents={{}} onChange={onChange} />,
    )
    const inputInitial = findInput(renderer)
    expect(inputInitial.props.value).toBe('')
    expect(inputInitial.props['data-error']).toBe('Invalid time value')

    act(() => {
      renderer.update(
        <DateField date={new Date(2025, 0, 13)} extents={{}} onChange={onChange} />,
      )
    })

    const inputChanged = findInput(renderer)
    expect(inputChanged.props.value).toBe('2025-01-13')
    expect(inputChanged.props['data-error']).toBeFalsy()
  })
})
