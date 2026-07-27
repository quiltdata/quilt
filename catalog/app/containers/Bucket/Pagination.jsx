import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

const Gap = Symbol('gap')

const MAX_PAGE_BUTTONS = 8 // fits on 320px-wide screen

// 1-based
// total | current  | output
// ------|----------|----------------------
// 8     | *        | [1, 2, 3, 4, 5, 6, 7, 8]
// 100   | 1...4    | [1, 2, 3, 4, 5, 6, <G>, 100]
// 100   | 5...95   | [1, <G>, N-1, N, N+1, N+2, <G>, 100]
// 100   | 96...100 | [1, <G>, 95, 96, 97, 98, 99, 100]
const displayRange = (total, current) => {
  if (total <= MAX_PAGE_BUTTONS) return R.range(1, total + 1)
  if (current <= MAX_PAGE_BUTTONS - 4) {
    return [...R.range(1, MAX_PAGE_BUTTONS - 1), Gap, total]
  }
  if (current >= total - MAX_PAGE_BUTTONS + 4) {
    return [1, Gap, ...R.range(total - MAX_PAGE_BUTTONS + 3, total + 1)]
  }
  return [1, Gap, ...R.range(current - 1, current + 3), Gap, total]
}

const usePaginationStyles = M.makeStyles((t) => ({
  button: {
    background: t.palette.common.white,
    paddingLeft: t.spacing(1.5),
    paddingRight: t.spacing(1.5),
  },
  current: {
    color: t.palette.primary.contrastText,
    backgroundColor: t.palette.primary.main,
    '&:hover': {
      backgroundColor: t.palette.primary.dark,
    },
  },
  gap: {
    cursor: 'default',
    pointerEvents: 'none',
  },
}))

export default function Pagination({ page, pages, makePageUrl }) {
  const classes = usePaginationStyles()
  const range = React.useMemo(() => displayRange(pages, page), [pages, page])

  return (
    <M.Box display="flex" justifyContent="center" mt={3} mb={{ xs: 5, sm: 0 }}>
      <M.ButtonGroup variant="contained">
        {range.map((p, i) =>
          p === Gap ? (
            <M.Button
              // eslint-disable-next-line react/no-array-index-key
              key={`gap:${i}`}
              className={cx(classes.button, classes.gap)}
              component="span"
            >
              &hellip;
            </M.Button>
          ) : (
            <M.Button
              key={`page:${p}`}
              component={Link}
              className={cx(classes.button, { [classes.current]: page === p })}
              to={makePageUrl(p)}
            >
              {p}
            </M.Button>
          ),
        )}
      </M.ButtonGroup>
    </M.Box>
  )
}
