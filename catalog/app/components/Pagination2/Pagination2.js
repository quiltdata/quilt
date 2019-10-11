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

const useStyles = M.makeStyles((t) => ({
  button: {
    background: t.palette.common.white,
    height: 40,
    lineHeight: 1,
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

export default function Pagination2({
  page,
  pages,
  makePageUrl,
  onChange,
  classes: customClasses = {},
  buttonGroupProps,
  ...props
}) {
  const classes = useStyles()
  const range = React.useMemo(() => displayRange(pages, page), [pages, page])

  const renderGap = (i) => (
    <M.Button
      // eslint-disable-next-line react/no-array-index-key
      key={`gap:${i}`}
      className={cx(classes.button, classes.gap, customClasses.button, customClasses.gap)}
      component="span"
    >
      &hellip;
    </M.Button>
  )

  const renderPage = (p) => {
    const ps = {}
    if (makePageUrl) {
      ps.component = Link
      ps.to = makePageUrl(p)
    }
    if (onChange) {
      ps.onClick = () => onChange(p)
    }
    return (
      <M.Button
        key={`page:${p}`}
        className={cx(
          classes.button,
          customClasses.button,
          page === p && classes.current,
          page === p && customClasses.current,
        )}
        {...ps}
      >
        {p}
      </M.Button>
    )
  }

  return (
    <M.Box display="flex" justifyContent="center" mt={3} mb={{ xs: 5, sm: 0 }} {...props}>
      <M.ButtonGroup variant="contained" {...buttonGroupProps}>
        {range.map((p, i) => (p === Gap ? renderGap(i) : renderPage(p)))}
      </M.ButtonGroup>
    </M.Box>
  )
}
