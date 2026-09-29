import { act, renderHook } from '@testing-library/react-hooks'
import { describe, expect, it } from 'vitest'

import { useSelection } from './Table'

interface Row {
  name: string
}

const row = (name: string): Row => ({ name })
const getId = (r: Row) => r.name

const render = (rows: readonly Row[]) =>
  renderHook(
    ({ rows: rs }: { rows: readonly Row[] }) => useSelection({ rows: rs, getId }),
    {
      initialProps: { rows },
    },
  )

describe('containers/Admin/Table/useSelection', () => {
  it('keeps the selection when the same rows arrive in a different order', () => {
    const { result, rerender } = render([row('a'), row('b'), row('c')])

    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })
    expect(result.current.count).toBe(2)

    rerender({ rows: [row('c'), row('b'), row('a')] })

    expect(result.current.count).toBe(2)
    expect(result.current.isSelected('a')).toBe(true)
    expect(result.current.isSelected('b')).toBe(true)
  })

  it('keeps the selection when an unselected row leaves', () => {
    const { result, rerender } = render([row('a'), row('b'), row('c')])

    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })

    rerender({ rows: [row('a'), row('b')] })

    expect(result.current.count).toBe(2)
    expect(result.current.selectedRows.map(getId)).toEqual(['a', 'b'])
  })

  it('drops rows that are no longer on screen', () => {
    const { result, rerender } = render([row('a'), row('b')])

    act(() => {
      result.current.toggle('a')
      result.current.toggle('b')
    })

    rerender({ rows: [row('c'), row('d')] })

    expect(result.current.count).toBe(0)
    expect(result.current.selectedRows).toEqual([])
  })

  // Fails if the effect that prunes off-page ids is dropped: the id would survive in
  // the stored set and come back selected.
  it('does not restore a selection made on a page the admin left', () => {
    const { result, rerender } = render([row('a'), row('b')])

    act(() => {
      result.current.toggle('a')
    })

    rerender({ rows: [row('c'), row('d')] })
    rerender({ rows: [row('a'), row('b')] })

    expect(result.current.count).toBe(0)
  })

  it('reports a partial selection after deselecting one of all', () => {
    const { result } = render([row('a'), row('b')])

    act(() => {
      result.current.toggleAll()
    })
    expect(result.current.allSelected).toBe(true)

    act(() => {
      result.current.toggle('a')
    })

    expect(result.current.someSelected).toBe(true)
    expect(result.current.allSelected).toBe(false)
  })
})
