import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Suggestions from 'components/SearchBar/Suggestions'
import useSearchState from 'components/SearchBar/State'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as SearchUIModel from 'containers/Search/model'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  appBar: {
    background: t.palette.common.white,
    borderRadius: `0 0 ${t.shape.borderRadius}px ${t.shape.borderRadius}px`,
    color: t.palette.getContrastText(t.palette.common.white),
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
  actions: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: 'auto',
  },
}))

// The pseudo-header: a global search bar with suggestions (scoped to the current
// bucket when in one). On the search page (which provides a live Search UI model
// above its Layout) the bar is bound to that model and IS the page's query input
// -- the page mounts no query field of its own.
export function ContentBar() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const bucket = Buckets.useCurrentBucket()
  // Non-null only on the search page, where the model is provided above the Layout.
  const searchModel = SearchUIModel.useUnsafe()
  const search = useSearchState(searchModel ?? bucket ?? null)
  const anchorRef = React.useRef<HTMLDivElement>(null)

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.AppBar
        position="sticky"
        color="inherit"
        className={classes.appBar}
        elevation={1}
      >
        <M.Toolbar className={classes.toolbar}>
          <div className={classes.search} ref={anchorRef}>
            <M.OutlinedInput
              {...search.input}
              // When bound to the search model, focus on mount: landing on the
              // search page (e.g. by submitting a search from another page)
              // keeps the user typing in the same spot (stands in for the
              // autoFocus of the in-body field the page used to mount).
              autoFocus={!!searchModel}
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
          <div className={classes.actions}>
            <M.Tooltip arrow title="Resolve a Quilt URI">
              <M.IconButton component={Link} to={urls.uriResolver('')}>
                <M.Icon className="material-icons-outlined">link</M.Icon>
              </M.IconButton>
            </M.Tooltip>
            <M.Tooltip arrow title="Documentation">
              <M.IconButton component="a" href={URLS.docs} target="_blank" rel="noopener">
                <M.Icon className="material-icons-outlined">menu_book</M.Icon>
              </M.IconButton>
            </M.Tooltip>
          </div>
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
