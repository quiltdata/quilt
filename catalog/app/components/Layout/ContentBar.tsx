import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import { Model as AssistantModel } from 'components/Assistant'
import Suggestions from 'components/SearchBar/Suggestions'
import useSearchState from 'components/SearchBar/State'
import cfg from 'constants/config'
import * as style from 'constants/style'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'
import SearchSuggestions from 'website/pages/Landing/FrontDoor/UnifiedBar/SearchSuggestions'

const useStyles = M.makeStyles((t) => ({
  appBar: {
    background: t.palette.common.white,
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
}))

// The pseudo-header: a global search bar with suggestions (scoped to the current
// bucket when in one). The search page has its own search field, so the bar is
// kept empty there (for alignment) rather than duplicating a field. When the
// FrontDoor is on, the home page carries its own unified bar, so this one is
// suppressed there.
export function ContentBar() {
  const classes = useStyles()
  const { paths } = NamedRoutes.use()
  const bucket = Buckets.useCurrentBucket()
  const onSearchPage = !!RRDom.useRouteMatch({ path: paths.search, exact: true })
  const onHome = !!RRDom.useRouteMatch({ path: paths.home, exact: true })
  const search = useSearchState(bucket ?? null)
  const anchorRef = React.useRef<HTMLDivElement>(null)

  // FrontDoor omni-suggestions (deep links into packages/objects/tables scopes)
  const quratorEnabled = !!AssistantModel.useIsEnabled()
  const assist = AssistantModel.useAssistant()
  const searchValue = typeof search.input.value === 'string' ? search.input.value : ''
  const onAskQurator = React.useCallback(() => {
    const trimmed = searchValue.trim()
    if (trimmed && assist) assist(trimmed)
  }, [assist, searchValue])

  // The search page has its own search field; every other page (incl. the
  // package list) uses the header search. When the FrontDoor is on, the home
  // page carries its own unified bar, so the header one is suppressed there.
  const hasOwnSearch = onSearchPage || (onHome && !!cfg.frontDoorV2)

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.AppBar position="sticky" color="inherit" className={classes.appBar}>
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
                  {cfg.frontDoorV2 && searchValue.trim() ? (
                    /* SearchSuggestions suspends on bucket data; never let it blank the shell */
                    <React.Suspense fallback={null}>
                      <SearchSuggestions
                        query={searchValue}
                        quratorEnabled={quratorEnabled}
                        onAskQurator={onAskQurator}
                      />
                    </React.Suspense>
                  ) : (
                    <Suggestions
                      classes={{ paper: classes.paper }}
                      open={search.helpOpen}
                      suggestions={search.suggestions}
                    />
                  )}
                </div>
              </M.Popper>
            </div>
          )}
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
