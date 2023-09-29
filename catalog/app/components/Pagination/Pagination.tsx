import * as R from 'ramda'
import * as React from 'react'

import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

function useSafeGetter<T = unknown, O = unknown>(
  value: T | undefined,
  get: (input: T) => O,
) {
  return React.useMemo(() => (value == null ? value : get(value)), [value, get])
}

function useHasChanged<T>(items: T[], getKeys: (x: T[]) => string[]) {
  const keys = useSafeGetter(items, getKeys)
  const oldItems = usePrevious(items)
  const oldKeys = useSafeGetter(oldItems, getKeys)
  if (R.is(Array, keys) && R.is(Array, oldKeys)) {
    // if new list == old list + more items (appended), consider it unchanged
    // to avoid resetting pagination on adding more items to the paginated set
    return !R.startsWith(oldKeys as string[], keys as string[])
  }
  return !R.equals(keys, oldKeys)
}

interface PaginationOptions<T = unknown> {
  getItemId: (v: T) => string
  perPage?: number
  onChange?: (prev: number | undefined, page: number) => void
}

export function usePagination<T = unknown>(
  items: T[],
  { getItemId, perPage: initialPerPage = PER_PAGE, onChange }: PaginationOptions<T>,
) {
  const [page, setPage] = React.useState(1)
  const [perPage, setPerPage] = React.useState(initialPerPage)

  const pages = Math.max(1, Math.ceil(items.length / perPage))

  const goToPage = React.useMemo(
    () => R.pipe(R.clamp(1, pages), setPage),
    [pages, setPage],
  )

  const nextPage = React.useCallback(() => goToPage(page + 1), [goToPage, page])

  const prevPage = React.useCallback(() => goToPage(page - 1), [goToPage, page])

  const getKeys = React.useCallback((x: T[]) => x.map(getItemId), [getItemId])

  if (useHasChanged(items, getKeys) && page !== 1) {
    // reset to page 1 if items change (but not if appended)
    goToPage(1)
  }

  const offset = (page - 1) * perPage

  const paginate: (x: T[]) => T[] = React.useMemo(
    () => R.slice(offset, offset + perPage),
    [offset, perPage],
  )
  const paginated = React.useMemo(() => paginate(items), [items, paginate])

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
