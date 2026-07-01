import * as R from 'ramda'
import * as React from 'react'

import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

function useGetter<V, W>(value: V, get: (v: V) => W): V | W {
  return React.useMemo(() => (value == null ? value : get(value)), [value, get])
}

function useHasChanged<V>(value: V, getKey: (v: V) => unknown = R.identity): boolean {
  const key = useGetter(value, getKey)
  const oldValue = usePrevious(value)
  const oldKey = useGetter(oldValue as V, getKey)
  if (R.is(Array, key) && R.is(Array, oldKey)) {
    // if new list == old list + more items (appended), consider it unchanged
    // to avoid resetting pagination on adding more items to the paginated set
    return !R.startsWith(oldKey as unknown[], key as unknown[])
  }
  return !R.equals(key, oldKey)
}

export interface UsePaginationOptions<T> {
  getItemId?: (item: T) => unknown
  perPage?: number
  onChange?: (prev: number | undefined, page: number) => void
}

export interface UsePaginationResult<T> {
  paginated: T[]
  total: number
  from: number
  to: number
  perPage: number
  setPerPage: React.Dispatch<React.SetStateAction<number>>
  page: number
  pages: number
  nextPage: () => void
  prevPage: () => void
  goToPage: (page: number) => void
}

export const usePagination = <T,>(
  items: readonly T[],
  {
    getItemId = R.identity,
    perPage: initialPerPage = PER_PAGE,
    onChange,
  }: UsePaginationOptions<T> = {},
): UsePaginationResult<T> => {
  const [page, setPage] = React.useState(1)
  const [perPage, setPerPage] = React.useState(initialPerPage)

  const pages = Math.max(1, Math.ceil(items.length / perPage))

  const goToPage = React.useMemo(
    () => R.pipe(R.clamp(1, pages), setPage),
    [pages, setPage],
  )

  const nextPage = React.useCallback(() => goToPage(page + 1), [goToPage, page])

  const prevPage = React.useCallback(() => goToPage(page - 1), [goToPage, page])

  const getKey = React.useMemo<(items: readonly T[]) => unknown[]>(
    () => R.map(getItemId),
    [getItemId],
  )
  if (useHasChanged(items, getKey) && page !== 1) {
    // reset to page 1 if items change (but not if appended)
    goToPage(1)
  }

  const offset = (page - 1) * perPage

  const paginated = React.useMemo(
    () => items.slice(offset, offset + perPage),
    [items, offset, perPage],
  )

  usePrevious(perPage, (prev) => {
    if (prev && perPage !== prev) {
      goToPage(Math.floor(((page - 1) * prev) / perPage) + 1)
    }
  })

  usePrevious(page, (prev) => {
    if (page !== prev && onChange) onChange(prev, page)
  })

  return {
    paginated,
    total: items.length,
    from: offset + 1,
    to: offset + perPage,
    perPage,
    setPerPage,
    page,
    pages,
    nextPage,
    prevPage,
    goToPage,
  }
}

export const use = usePagination

interface PaginationProps<T> extends UsePaginationOptions<T> {
  items: readonly T[]
  children: (result: UsePaginationResult<T>) => React.ReactNode
}

export function Pagination<T>({ children, items, ...props }: PaginationProps<T>) {
  return children(use(items, props))
}
