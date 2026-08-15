import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Suggestions, { suggestionOptionId } from 'components/SearchBar/Suggestions'
import useSearchState from 'components/SearchBar/State'
import * as style from 'constants/style'
import * as URLS from 'constants/urls'
import * as SearchUIModel from 'containers/Search/model'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

import { useSearchInputRef } from './SearchInput'

const useStyles = M.makeStyles((t) => ({
  // The band is chrome, not a card: flat (no resting shadow), square, full-bleed
  // to the rail edge, delineated by a bottom hairline, and height-registered
  // with the rail's 64px logo block so one header line crosses the seam.
  appBar: {
    background: t.palette.common.white,
    borderBottom: `1px solid ${t.palette.divider}`,
    color: t.palette.getContrastText(t.palette.common.white),
  },
  // minHeight only: a hard height clips the row when text scales on its own
  // (text-only zoom, or a user minimum font size) instead of letting it grow.
  toolbar: {
    minHeight: 64,
    paddingLeft: t.spacing(3),
    paddingRight: t.spacing(3),
  },
  // Only rendered in the compact shell, where the rail is an overlay: this is
  // the only way back to navigation, so it leads the bar.
  menu: {
    marginLeft: t.spacing(-1),
    marginRight: t.spacing(1),
    '&.Mui-focusVisible': {
      boxShadow: `0 0 0 2px ${t.palette.primary.main}`,
    },
  },
  search: {
    flexGrow: 1,
    maxWidth: t.spacing(90),
  },
  // White-on-white field defined by a prominent resting border; MUI's native
  // hover darken and the standard 2px focus ring carry the state ladder.
  field: {
    backgroundColor: t.palette.common.white,
    fontSize: t.typography.body2.fontSize,
    '& $outline': {
      borderColor: fade(t.palette.common.black, 0.38),
      transition: t.transitions.create('border-color', { duration: 150 }),
    },
    '&:focus-within $searchIcon': {
      color: t.palette.text.secondary,
    },
    '&:focus-within $hint': {
      visibility: 'hidden',
    },
    '& input::placeholder': {
      color: fade(t.palette.common.black, 0.6),
      opacity: 1,
    },
  },
  outline: {},
  searchIcon: {
    color: fade(t.palette.common.black, 0.38),
    transition: t.transitions.create('color', { duration: 150 }),
  },
  // Keyboard-shortcut keycap; hidden while the field is focused.
  hint: {
    alignItems: 'center',
    border: `1px solid ${fade(t.palette.common.black, 0.23)}`,
    borderRadius: 2,
    color: t.palette.text.secondary,
    display: 'inline-flex',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    height: 20,
    justifyContent: 'center',
    width: 20,
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
  action: {
    '&.Mui-focusVisible': {
      boxShadow: `0 0 0 2px ${t.palette.primary.main}`,
    },
  },
}))

// The suggestions list's id, shared between the input's `aria-controls` and the
// listbox itself so assistive tech can tie the two together.
const SUGGESTIONS_ID = 'header-search-suggestions'

// The pseudo-header: a global search bar with suggestions (scoped to the current
// bucket when in one). On the search page (which provides a live Search UI model
// above its Layout) the bar is bound to that model and IS the page's query input
// -- the page mounts no query field of its own.
export interface ContentBarProps {
  // Supplied only by the compact shell, where the rail is an overlay and this
  // button is the way to reach it. Absent on wide viewports, where the rail is
  // always on screen and a menu button would toggle nothing.
  onMenu?: () => void
}

export function ContentBar({ onMenu }: ContentBarProps = {}) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const bucket = Buckets.useCurrentBucket()
  // Non-null only on the search page, where the model is provided above the Layout.
  const searchModel = SearchUIModel.useUnsafe()
  const search = useSearchState(searchModel ?? bucket ?? null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  // Shared with the page below via the Layout, which is how the search screen's
  // refine affordances reach this field. Falls back to a local ref so the bar
  // still works when rendered outside a Layout.
  const localInputRef = React.useRef<HTMLInputElement | null>(null)
  const inputRef = useSearchInputRef() ?? localInputRef

  // The row the arrow keys have highlighted, named so the input can point at it
  // via aria-activedescendant. Must agree with the id Suggestions renders.
  // Guarded: `suggestions` is null until the state machine has any (and stays
  // null for consumers that mount the bar without a suggestions source).
  const activeSuggestionId = search.suggestions?.items?.length
    ? suggestionOptionId(SUGGESTIONS_ID, search.suggestions.selected)
    : null

  // '/' (and Cmd/Ctrl+K) focuses the bar from anywhere, except while typing
  // in another input.
  React.useEffect(() => {
    const onKeyDown = (evt: KeyboardEvent) => {
      const slash = evt.key === '/' && !evt.metaKey && !evt.ctrlKey && !evt.altKey
      const cmdK = evt.key.toLowerCase() === 'k' && (evt.metaKey || evt.ctrlKey)
      if (!slash && !cmdK) return
      const target = evt.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      )
        return
      evt.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [inputRef])

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.AppBar
        position="sticky"
        color="inherit"
        className={classes.appBar}
        elevation={0}
        square
      >
        <M.Toolbar className={classes.toolbar} disableGutters>
          {!!onMenu && (
            <M.Tooltip arrow title="Navigation">
              <M.IconButton
                aria-label="Open navigation"
                className={classes.menu}
                onClick={onMenu}
              >
                <M.Icon>menu</M.Icon>
              </M.IconButton>
            </M.Tooltip>
          )}
          <div className={classes.search} ref={anchorRef}>
            <M.OutlinedInput
              {...search.input}
              // When bound to the search model, focus on mount: landing on the
              // search page (e.g. by submitting a search from another page)
              // keeps the user typing in the same spot (stands in for the
              // autoFocus of the in-body field the page used to mount).
              autoFocus={!!searchModel}
              onBlur={search.onClickAway}
              inputRef={inputRef}
              fullWidth
              margin="dense"
              placeholder="Search"
              // The field IS a combobox: it owns a popup list whose highlighted
              // row is what Enter commits (see SearchBar/State handleSubmit).
              // Without this wiring the placeholder is the only name (announced
              // as "edit text, blank"), and the arrow-key highlight is a CSS
              // class no assistive tech can see -- so Enter fires a navigation
              // the user cannot perceive.
              inputProps={{
                'aria-label': 'Search packages and objects',
                role: 'combobox',
                'aria-expanded': search.helpOpen,
                'aria-controls': SUGGESTIONS_ID,
                'aria-autocomplete': 'list',
                ...(search.helpOpen && activeSuggestionId
                  ? { 'aria-activedescendant': activeSuggestionId }
                  : null),
              }}
              classes={{
                root: classes.field,
                notchedOutline: classes.outline,
              }}
              labelWidth={0}
              startAdornment={
                <M.InputAdornment position="start">
                  <M.Icon className={classes.searchIcon}>search</M.Icon>
                </M.InputAdornment>
              }
              endAdornment={
                <M.InputAdornment position="end">
                  <span className={classes.hint}>/</span>
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
                  listId={SUGGESTIONS_ID}
                  onAsk={search.onAsk}
                  open={search.helpOpen}
                  suggestions={search.suggestions}
                />
              </div>
            </M.Popper>
          </div>
          <div className={classes.actions}>
            <M.Tooltip arrow title="Resolve a Quilt URI">
              <M.IconButton
                className={classes.action}
                component={Link}
                to={urls.uriResolver('')}
              >
                <M.Icon className="material-icons-outlined">link</M.Icon>
              </M.IconButton>
            </M.Tooltip>
            <M.Tooltip arrow title="Documentation">
              <M.IconButton
                className={classes.action}
                component="a"
                href={URLS.docs}
                target="_blank"
                rel="noopener"
              >
                <M.Icon className="material-icons-outlined">menu_book</M.Icon>
              </M.IconButton>
            </M.Tooltip>
          </div>
        </M.Toolbar>
      </M.AppBar>
    </M.MuiThemeProvider>
  )
}
