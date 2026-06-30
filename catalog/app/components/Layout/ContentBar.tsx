import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexShrink: 0,
    gap: t.spacing(1),
    padding: t.spacing(1, 2),
  },
  search: {
    flexGrow: 1,
  },
  input: {
    background: t.palette.background.paper,
  },
  spacer: {
    flexGrow: 1,
  },
}))

// Replaces the old top header: a global search bar (context-aware — scoped to
// the current bucket when in one) plus the AI assistant trigger on the right.
export function ContentBar() {
  const classes = useStyles()
  const { urls, paths } = NamedRoutes.use()
  const history = RRDom.useHistory()
  const bucket = Buckets.useCurrentBucket()
  // The search page provides its own search field, so don't duplicate it there.
  const onSearchPage = !!RRDom.useRouteMatch({ path: paths.search, exact: true })
  const [query, setQuery] = React.useState('')

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      history.push(
        urls.search({ q: query || undefined, buckets: bucket ? [bucket] : undefined }),
      )
    },
    [history, urls, query, bucket],
  )

  return (
    <div className={classes.root}>
      {onSearchPage ? (
        <div className={classes.spacer} />
      ) : (
        <form className={classes.search} onSubmit={handleSubmit}>
          <M.TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              className: classes.input,
              startAdornment: (
                <M.InputAdornment position="start">
                  <M.Icon>search</M.Icon>
                </M.InputAdornment>
              ),
            }}
          />
        </form>
      )}
      <Assistant.UI.Trigger />
    </div>
  )
}
