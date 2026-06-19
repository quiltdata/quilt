import cx from 'classnames'
import * as React from 'react'
import { useHistory, useLocation, useRouteMatch } from 'react-router-dom'
import * as M from '@material-ui/core'

import { Model as AssistantModel } from 'components/Assistant'
import * as style from 'constants/style'
import { search } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'
import { classifyQuery } from 'website/pages/Landing/FrontDoor/UnifiedBar/classify'
import SearchSuggestions from 'website/pages/Landing/FrontDoor/UnifiedBar/SearchSuggestions'

// Compact navbar variant of the FrontDoor unified search bar. It reuses the
// FrontDoor classify/deep-link behavior (SearchSuggestions) but is styled for
// the light nav surface and renders its dropdown in a Popper so it is not
// clipped by the nav layout.

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    marginLeft: 'auto',
    position: 'relative',
  },
  pill: {
    alignItems: 'center',
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: 18,
    display: 'flex',
    height: 36,
    minWidth: 220,
    padding: t.spacing(0, 1.5),
    transition: 'background .2s, border-color .2s',
    '&:hover': {
      background: 'rgba(255,255,255,.16)',
    },
  },
  pillFocused: {
    background: 'rgba(255,255,255,.2)',
    borderColor: 'rgba(255,255,255,.4)',
  },
  lead: {
    color: 'rgba(255,255,255,.7)',
    fontSize: 18,
    marginRight: t.spacing(1),
  },
  input: {
    background: 'transparent',
    border: 0,
    color: t.palette.common.white,
    flex: 1,
    font: 'inherit',
    fontSize: 14,
    minWidth: 0,
    outline: 0,
    padding: 0,
    '&::placeholder': {
      color: 'rgba(255,255,255,.6)',
    },
  },
  kbd: {
    background: 'rgba(255,255,255,.12)',
    borderRadius: 4,
    color: 'rgba(255,255,255,.7)',
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 11,
    marginLeft: t.spacing(1),
    padding: t.spacing(0.125, 0.75),
  },
  popper: {
    width: 420,
    zIndex: t.zIndex.appBar + 2,
  },
}))

export default function OmniSearch() {
  const classes = useStyles()
  const history = useHistory()
  const location = useLocation()
  const { paths } = NamedRoutes.use()
  const isHome = !!useRouteMatch({ path: paths.home, exact: true })
  const anchorRef = React.useRef<HTMLDivElement>(null)

  const quratorEnabled = !!AssistantModel.useIsEnabled()
  const assist = AssistantModel.useAssistant()

  const [value, setValue] = React.useState('')
  const [focused, setFocused] = React.useState(false)
  const trimmed = value.trim()
  const route = classifyQuery(value, quratorEnabled)

  const runQurator = React.useCallback(() => {
    if (!trimmed) return
    if (assist) assist(trimmed)
    else history.push(search.url({ q: trimmed }))
  }, [assist, history, trimmed])

  const submit = React.useCallback(() => {
    if (!trimmed) return
    if (route === 'Qurator') runQurator()
    else history.push(search.url({ q: trimmed }))
  }, [history, route, runQurator, trimmed])

  // Close the dropdown after navigation so a stale popover is never left behind.
  const pathKey = `${location.pathname}${location.search}`
  React.useEffect(() => {
    setFocused(false)
    setValue('')
  }, [pathKey])

  const open = focused && !!trimmed

  // The FrontDoor hero already provides the primary unified search bar, so the
  // navbar omnisearch is suppressed on the landing page to avoid duplication.
  if (isHome) return null

  return (
    <M.ClickAwayListener onClickAway={() => setFocused(false)}>
      <div className={classes.root}>
        <div
          ref={anchorRef}
          className={cx(classes.pill, focused && classes.pillFocused)}
          role="search"
        >
          <M.Icon className={classes.lead}>search</M.Icon>
          <input
            aria-label="Search or ask Qurator"
            className={classes.input}
            placeholder="Search packages, objects & tables…"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              } else if (event.key === 'Escape') {
                setFocused(false)
              }
            }}
          />
          {!trimmed && <span className={classes.kbd}>Enter</span>}
        </div>
        <M.Popper
          anchorEl={anchorRef.current}
          className={classes.popper}
          open={open}
          placement="bottom-end"
        >
          <M.MuiThemeProvider theme={style.appTheme}>
            <SearchSuggestions
              query={value}
              quratorEnabled={quratorEnabled}
              onAskQurator={runQurator}
            />
          </M.MuiThemeProvider>
        </M.Popper>
      </div>
    </M.ClickAwayListener>
  )
}
