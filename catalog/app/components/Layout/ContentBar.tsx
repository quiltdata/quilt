import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import { Model as AssistantModel } from 'components/Assistant'
import Suggestions from 'components/SearchBar/Suggestions'
import useSearchState from 'components/SearchBar/State'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as NamedRoutes from 'utils/NamedRoutes'
import SearchSuggestions from 'website/pages/Landing/FrontDoor/UnifiedBar/SearchSuggestions'

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
// alignment rather than duplicating a search field. When the FrontDoor is on,
// the home page carries its own unified bar, so this one is suppressed there.
export function ContentBar() {
  const classes = useStyles()
  const { paths } = NamedRoutes.use()
  const onSearchPage = !!RRDom.useRouteMatch({ path: paths.search, exact: true })
  const onPackageList = !!RRDom.useRouteMatch({ path: paths.bucketPackageList })
  const onHome = !!RRDom.useRouteMatch({ path: paths.home, exact: true })
  const search = useSearchState()

  // FrontDoor omni-suggestions (deep links into packages/objects/tables scopes)
  const quratorEnabled = !!AssistantModel.useIsEnabled()
  const assist = AssistantModel.useAssistant()
  const searchValue = typeof search.input.value === 'string' ? search.input.value : ''
  const onAskQurator = React.useCallback(() => {
    const trimmed = searchValue.trim()
    if (trimmed && assist) assist(trimmed)
  }, [assist, searchValue])

  const hasOwnSearch = onSearchPage || onPackageList || (onHome && !!cfg.frontDoorV2)

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
                  placeholder="Search packages, objects, and tables"
                  className={classes.input}
                  labelWidth={0}
                  startAdornment={
                    <M.InputAdornment position="start">
                      <M.Icon>search</M.Icon>
                    </M.InputAdornment>
                  }
                />
                {searchValue.trim() ? (
                  search.helpOpen && (
                    <div className={classes.paper}>
                      {/* SearchSuggestions suspends on bucket data; never let it blank the shell */}
                      <React.Suspense fallback={null}>
                        <SearchSuggestions
                          query={searchValue}
                          quratorEnabled={quratorEnabled}
                          onAskQurator={onAskQurator}
                        />
                      </React.Suspense>
                    </div>
                  )
                ) : (
                  <Suggestions
                    classes={{ paper: classes.paper }}
                    open={search.helpOpen}
                    suggestions={search.suggestions}
                  />
                )}
              </div>
            </M.ClickAwayListener>
          )}
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
