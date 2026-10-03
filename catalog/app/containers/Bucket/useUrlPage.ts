import * as React from 'react'
import * as RRDom from 'react-router-dom'

import mkSearch from 'utils/mkSearch'
import parseSearch from 'utils/parseSearch'

// The grid counts pages from 0; `p` counts from 1, as on package revisions.
// Replace, not push: Back should leave the listing, not step through its pages.
export default function useUrlPage(): [number, (page: number) => void] {
  const history = RRDom.useHistory()
  const { p } = parseSearch(RRDom.useLocation().search, true)
  const page = Math.max(0, (parseInt(p ?? '', 10) || 1) - 1)
  const setPage = React.useCallback(
    (newPage: number) => {
      const { search } = history.location
      const params = { ...parseSearch(search), p: newPage > 0 ? newPage + 1 : undefined }
      history.replace({ ...history.location, search: mkSearch(params) })
    },
    [history],
  )
  return [page, setPage]
}
