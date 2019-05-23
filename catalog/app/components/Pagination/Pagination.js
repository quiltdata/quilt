import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'

import * as RT from 'utils/reactTools'
import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

const useGetter = (value, get) =>
  React.useMemo(() => (value == null ? value : get(value)), [value, get])

const useHasChanged = (value, getKey = R.identity) => {
  const key = useGetter(value, getKey)
  const oldValue = usePrevious(value)
  const oldKey = useGetter(oldValue, getKey)
  return !R.equals(key, oldKey)
}

export const usePagination = (
  items,
  { getItemId = R.identity, perPage: initialPerPage = PER_PAGE, onChange } = {},
) => {
  const [page, setPage] = React.useState(1)
  const [perPage, setPerPage] = React.useState(initialPerPage)

  const pages = Math.max(1, Math.ceil(items.length / perPage))

  const goToPage = React.useCallback(
    R.pipe(
      R.clamp(1, pages),
      setPage,
    ),
    [pages, setPage],
  )

  const nextPage = React.useCallback(() => goToPage(page + 1), [goToPage, page])

  const prevPage = React.useCallback(() => goToPage(page - 1), [goToPage, page])

  const getKey = useGetter(getItemId, R.map)
  if (useHasChanged(items, getKey) && page !== 1) {
    // reset to page 1 if items change
    goToPage(1)
  }

  const offset = (page - 1) * perPage

  const paginate = React.useCallback(R.slice(offset, offset + perPage), [offset, perPage])
  const paginated = useGetter(items, paginate)

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

export const Paginate = RT.composeComponent(
  'Pagination.Paginate',
  RC.setPropTypes({
    items: PT.array.isRequired,
    children: PT.func.isRequired,
  }),
  ({ items, children, ...props }) => children(use(items, props)),
)
