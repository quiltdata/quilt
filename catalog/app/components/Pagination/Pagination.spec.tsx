import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { usePagination } from './Pagination'

const items = Array.from({ length: 25 }, (_, i) => i)

describe('components/Pagination usePagination', () => {
  it('paginates with the default page size of 10', () => {
    const { result } = renderHook(() => usePagination(items))
    expect(result.current.page).toBe(1)
    expect(result.current.pages).toBe(3)
    expect(result.current.total).toBe(25)
    expect(result.current.from).toBe(1)
    expect(result.current.to).toBe(10)
    expect(result.current.paginated).toEqual(items.slice(0, 10))
  })

  it('navigates between pages', () => {
    const { result } = renderHook(() => usePagination(items))
    act(() => result.current.nextPage())
    expect(result.current.page).toBe(2)
    expect(result.current.paginated).toEqual(items.slice(10, 20))
    act(() => result.current.prevPage())
    expect(result.current.page).toBe(1)
    expect(result.current.paginated).toEqual(items.slice(0, 10))
  })

  it('clamps goToPage to the valid range', () => {
    const { result } = renderHook(() => usePagination(items))
    act(() => result.current.goToPage(99))
    expect(result.current.page).toBe(3)
    act(() => result.current.goToPage(-5))
    expect(result.current.page).toBe(1)
  })

  it('respects a custom perPage', () => {
    const { result } = renderHook(() => usePagination(items, { perPage: 5 }))
    expect(result.current.pages).toBe(5)
    expect(result.current.paginated).toHaveLength(5)
  })

  it('always reports at least one page, even for an empty list', () => {
    const { result } = renderHook(() => usePagination([]))
    expect(result.current.pages).toBe(1)
    expect(result.current.total).toBe(0)
    expect(result.current.paginated).toEqual([])
  })

  it('fires onChange with the previous and next page on navigation', () => {
    const onChange = vi.fn()
    const { result } = renderHook(() => usePagination(items, { onChange }))
    act(() => result.current.nextPage())
    expect(onChange).toHaveBeenCalledWith(1, 2)
  })
})
