import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Suggestions from 'components/SearchBar/Suggestions'
import useSearchState from 'components/SearchBar/State'
import * as style from 'constants/style'
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
    position: 'relative',
  },
  input: {
    background: style.appTheme.palette.background.paper,
  },
  paper: {
    left: 0,
    marginTop: t.spacing(0.5),
    position: 'absolute',
    right: 0,
    top: '100%',
    zIndex: t.zIndex.appBar + 2,
  },
}))

// The pseudo-header: a global search bar with suggestions. Pages that carry
// their own search (the search page, the package list) keep the bar empty for
// alignment rather than duplicating a search field.
export function ContentBar() {
  const classes = useStyles()
  const { paths } = NamedRoutes.use()
  const onSearchPage = !!RRDom.useRouteMatch({ path: paths.search, exact: true })
  const onPackageList = !!RRDom.useRouteMatch({ path: paths.bucketPackageList })
  const search = useSearchState()

  const hasOwnSearch = onSearchPage || onPackageList

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.AppBar position="static" color="inherit" className={classes.appBar}>
        <M.Toolbar className={classes.toolbar}>
          {!hasOwnSearch && (
            <M.ClickAwayListener onClickAway={search.onClickAway}>
              <div className={classes.search}>
                <M.OutlinedInput
                  {...search.input}
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
                <Suggestions
                  classes={{ paper: classes.paper }}
                  open={search.helpOpen}
                  suggestions={search.suggestions}
                />
              </div>
            </M.ClickAwayListener>
          )}
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
