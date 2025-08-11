import * as React from 'react'
import { act, create } from 'react-test-renderer'

import { NumberField } from './NumbersRange'

jest.mock(
  'd3-scale',
  jest.fn(() => {}),
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
const findInput = (tree: any) => tree.root.findByType('input')

describe('components/Filters/NumbersRange', () => {
  describe('NumberField', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('renders with a valid number', () => {
      const renderer = create(<NumberField value={42} extents={{}} onChange={onChange} />)
      const input = findInput(renderer)
      expect(input.props.value).toBe('42')
      expect(input.props['data-error']).toBeFalsy()
    })

    it('updates value when value changes', () => {
      const renderer = create(<NumberField value={13} extents={{}} onChange={onChange} />)
      expect(findInput(renderer).props.value).toBe('13')

      act(() => {
        renderer.update(<NumberField value={15} extents={{}} onChange={onChange} />)
      })
      expect(findInput(renderer).props.value).toBe('15')
    })

    it('sets min/max from extents', () => {
      const renderer = create(
        <NumberField value={10} extents={{ min: 1, max: 100 }} onChange={onChange} />,
      )
      const input = findInput(renderer)
      expect(input.props.min).toBe('1')
      expect(input.props.max).toBe('100')
    })

    it('handles null/undefined extents gracefully', () => {
      const renderer = create(<NumberField value={10} extents={{}} onChange={onChange} />)
      const input = findInput(renderer)
      expect(input.props.min).toBeUndefined()
      expect(input.props.max).toBeUndefined()
    })

    it('shows empty value when number is null', () => {
      const renderer = create(
        <NumberField value={null} extents={{}} onChange={onChange} />,
      )
      const input = findInput(renderer)
      expect(input.props.value).toBe('')
      expect(input.props['data-error']).toBe('Enter number, please')
    })

    it('handles zero correctly', () => {
      const renderer = create(<NumberField value={0} extents={{}} onChange={onChange} />)
      const input = findInput(renderer)
      expect(input.props.value).toBe('0')
      expect(input.props['data-error']).toBeFalsy()
    })

    it('treats NaN as invalid', () => {
      const renderer = create(
        // @ts-expect-error
        <NumberField value={'abc'} extents={{}} onChange={onChange} />,
      )
      const input = findInput(renderer)
      expect(input.props.value).toBe('')
      expect(input.props['data-error']).toBe('Not a number')
    })
  })
})
