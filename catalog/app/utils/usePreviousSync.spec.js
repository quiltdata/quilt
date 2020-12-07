import * as React from 'react'
import { act, renderHook } from '@testing-library/react-hooks'

import usePreviousSync from './usePreviousSync'

describe('utils/usePreviousSync', () => {
  it('should return the same value', () => {
    const initialValue = { initial: 'value' }

    const { result } = renderHook(() => usePreviousSync(initialValue))

    expect(result.current).toBe(initialValue)
  })

  it('should callback with previous value', () => {
    const initialValue = { initial: 'value' }

    const useTestCase = (input) => {
      const prevValueRef = React.useRef()
      const [value, updateValue] = React.useState(input)

      usePreviousSync(value, (prev) => {
        prevValueRef.current = prev
      })

      return {
        value,
        updateValue,
        prevValueRef,
      }
    }

    const { result } = renderHook(() => useTestCase(initialValue))

    expect(result.current.value).toBe(initialValue)
    expect(result.current.prevValueRef.current).toBe(undefined)

    act(() => {
      result.current.updateValue('next value')
    })

    expect(result.current.value).toBe('next value')
    expect(result.current.prevValueRef.current).toBe(initialValue)

    act(() => {
      result.current.updateValue('third value to be sure')
    })

    expect(result.current.value).toBe('third value to be sure')
    expect(result.current.prevValueRef.current).toBe('next value')
  })
})
