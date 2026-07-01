import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Suggestions from 'components/SearchBar/Suggestions'
import useSearchState from 'components/SearchBar/State'
import * as style from 'constants/style'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  appBar: {
    background: style.navTheme.palette.secondary.dark,
    color: t.palette.common.white,
  },
  toolbar: {
    height: 64,
    minHeight: 64,
  },
  search: {
    flexGrow: 1,
    maxWidth: t.spacing(90),
  },
  input: {
    background: style.appTheme.palette.background.paper,
  },
  // The dropdown is portaled (M.Popper) so it floats above the per-bucket tabs
  // bar instead of being clipped by it.
  popper: {
    zIndex: t.zIndex.appBar + 2,
  },
  paper: {
    marginTop: t.spacing(0.5),
    width: '100%',
  },
}))

// The pseudo-header: a global search bar with suggestions (scoped to the current
// bucket when in one). Pages that carry their own search (the search page, the
// package list) keep the bar empty for alignment rather than duplicating a field.
export function ContentBar() {
  const classes = useStyles()
  const { paths } = NamedRoutes.use()
  const bucket = Buckets.useCurrentBucket()
  const onSearchPage = !!RRDom.useRouteMatch({ path: paths.search, exact: true })
  const onPackageList = !!RRDom.useRouteMatch({ path: paths.bucketPackageList })
  const search = useSearchState(bucket ?? null)
  const anchorRef = React.useRef<HTMLDivElement>(null)

  const hasOwnSearch = onSearchPage || onPackageList

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.AppBar position="static" color="inherit" className={classes.appBar}>
        <M.Toolbar className={classes.toolbar}>
          {!hasOwnSearch && (
            <div className={classes.search} ref={anchorRef}>
              <M.OutlinedInput
                {...search.input}
                onBlur={search.onClickAway}
                fullWidth
                margin="dense"
                placeholder="Search"
                className={classes.input}
                labelWidth={0}
                startAdornment={
                  <M.InputAdornment position="start">
                    <M.Icon>search</M.Icon>
                  </M.InputAdornment>
                }
              />
              <M.Popper
                anchorEl={anchorRef.current}
                className={classes.popper}
                open={search.helpOpen}
                placement="bottom-start"
                style={{ width: anchorRef.current?.clientWidth }}
              >
                {/* Keep focus on the input while clicking a suggestion so it
                    navigates before onBlur closes the dropdown. */}
                <div onMouseDown={(e) => e.preventDefault()}>
                  <Suggestions
                    classes={{ paper: classes.paper }}
                    open={search.helpOpen}
                    suggestions={search.suggestions}
                  />
                </div>
              </M.Popper>
            </div>
          )}
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
