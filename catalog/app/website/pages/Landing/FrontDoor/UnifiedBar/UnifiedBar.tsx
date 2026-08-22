import * as R from 'ramda'
import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as Lab from '@material-ui/lab'

import { search } from 'constants/routes'
import { Model as AssistantModel } from 'components/Assistant'
// The same classifier the header's SearchBar submits through, so the front door
// and the header can't disagree about what counts as a question.
import { classifyQuery } from 'components/SearchBar/classify'

import Input from './Input'
import QuratorPanel from './QuratorPanel'
import SearchSuggestions, {
  suggestionOptionId,
  type SearchSuggestionsHandle,
} from './SearchSuggestions'

const SUGGESTIONS_ID = 'front-door-suggestions'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: `${t.spacing(4)}px auto 0`,
    maxWidth: 1040,
  },
  hint: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: t.typography.body2.fontSize,
    gap: t.spacing(0.5),
    justifyContent: 'center',
    marginTop: t.spacing(1),
    minHeight: 20,
    '& b': {
      color: t.palette.text.primary,
      fontWeight: t.typography.fontWeightMedium,
    },
  },
  hintIcon: {
    fontSize: t.typography.body1.fontSize,
  },
  // The same keycap idiom as the header bar's '/' hint (ContentBar): a hairline
  // outline on the page ground, mono face, no fill.
  kbd: {
    border: `1px solid ${fade(t.palette.common.black, 0.23)}`,
    borderRadius: 2,
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: t.typography.caption.fontSize,
    padding: t.spacing(0, 0.5),
  },
  helper: {
    marginTop: t.spacing(1),
    textAlign: 'center',
  },
  // The suspended-suggestions placeholder. It carries the same outline, radius
  // and offset as the resolved list (SearchSuggestions' `root`) and reserves a
  // plausible height, so the list fades in where the placeholder was instead of
  // shoving the page around it. A collapsing fallback here would make everything
  // below the bar jump on every cold read.
  suggestionsPlaceholder: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(2),
    overflow: 'hidden',
    padding: t.spacing(1, 2),
    // Universal reduced-motion escape hatch (as in containers/Home/Buckets):
    // kills Lab.Skeleton's pulse without reaching for its hashed class name.
    '@media (prefers-reduced-motion: reduce)': {
      '& *': {
        animationDuration: '0.01ms !important',
        animationIterationCount: '1 !important',
      },
    },
  },
  suggestionsPlaceholderRow: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    // Matches the dense ListItem rows the real list resolves into.
    height: 40,
  },
}))

// Stands in for the suggestions list while its bucket data is in flight.
// `aria-hidden`: the field's `aria-expanded` already says the popup is closed
// while this is on screen, so announcing skeleton rows as options would
// contradict it.
function SuggestionsPlaceholder() {
  const classes = useStyles()
  return (
    <div aria-hidden className={classes.suggestionsPlaceholder}>
      {R.range(0, 3).map((i) => (
        <div className={classes.suggestionsPlaceholderRow} key={i}>
          <Lab.Skeleton variant="circle" width={24} height={24} />
          <Lab.Skeleton variant="text" width="45%" height={16} />
        </div>
      ))}
    </div>
  )
}

interface UnifiedBarProps {
  value: string
  onChange: (value: string) => void
}

export default function UnifiedBar({ value, onChange }: UnifiedBarProps) {
  const classes = useStyles()
  const history = useHistory()
  const quratorEnabled = !!AssistantModel.useIsEnabled()
  const assist = AssistantModel.useAssistant()
  const route = classifyQuery(value, quratorEnabled)
  const [forceSearch, setForceSearch] = React.useState(false)
  const trimmed = value.trim()

  // Allow the user to downgrade a Qurator-routed query to plain search for this
  // keystroke session; cleared whenever the query text changes.
  const effectiveRoute = forceSearch ? 'Search' : route

  const submitSearch = React.useCallback(() => {
    if (!trimmed) return
    history.push(search.url({ q: trimmed }))
  }, [history, trimmed])

  const runQurator = React.useCallback(() => {
    if (!trimmed) return
    if (assist) assist(trimmed)
    else submitSearch()
  }, [assist, submitSearch, trimmed])

  // Which suggestion row the arrow keys have highlighted; -1 is the resting
  // state, where Enter still means "run the bar's own route". Nothing is
  // preselected on purpose -- auto-highlighting the first row would silently
  // retarget Enter away from the destination the hint text promises.
  const [highlight, setHighlight] = React.useState(-1)
  const suggestionsRef = React.useRef<SearchSuggestionsHandle>(null)
  // How many rows the list is currently showing, reported up by the list itself.
  // This is state rather than a ref read because `aria-expanded` is a render-time
  // claim: the ref is null on the field's first paint, so reading it there would
  // report "closed" forever.
  const [rowCount, setRowCount] = React.useState(0)
  const listShowing = effectiveRoute === 'Search' && rowCount > 0

  const handleRowCount = React.useCallback((count: number) => {
    setRowCount(count)
    // A shrinking list must not leave the highlight pointing past the end --
    // that would announce an id that no longer resolves and make Enter a no-op.
    setHighlight((prev) => (prev >= count ? -1 : prev))
  }, [])

  const submit = React.useCallback(() => {
    // A highlighted row wins: it is what the field is announcing, so it has to
    // be what Enter commits.
    if (highlight >= 0 && suggestionsRef.current) {
      suggestionsRef.current.activate(highlight)
      return
    }
    if (effectiveRoute === 'Search') submitSearch()
    else runQurator()
  }, [effectiveRoute, highlight, runQurator, submitSearch])

  const handleChange = React.useCallback(
    (next: string) => {
      setForceSearch(false)
      // The row under the old highlight index is not the row that will be under
      // it after the query changes, so drop it rather than let it drift.
      setHighlight(-1)
      onChange(next)
    },
    [onChange],
  )

  const handleArrow = React.useCallback(
    (reverse: boolean) => {
      // Wrap at both ends: ArrowUp from the resting state lands on the last row,
      // which is how the header bar's list behaves.
      if (!rowCount) return
      setHighlight((prev) => {
        if (reverse) return prev <= 0 ? rowCount - 1 : prev - 1
        return prev >= rowCount - 1 ? 0 : prev + 1
      })
    },
    [rowCount],
  )

  // Escape backs out one step at a time: give up the highlight first, and only
  // clear the query once there is no highlight left to give up.
  const handleEscape = React.useCallback(() => {
    if (highlight >= 0) setHighlight(-1)
    else onChange('')
  }, [highlight, onChange])

  return (
    <div className={classes.root}>
      <Input
        route={effectiveRoute}
        showRouteBadge={quratorEnabled}
        value={value}
        onChange={handleChange}
        onSubmit={submit}
        listId={SUGGESTIONS_ID}
        expanded={listShowing}
        activeOptionId={
          highlight >= 0 ? suggestionOptionId(SUGGESTIONS_ID, highlight) : null
        }
        onArrow={handleArrow}
        onEscape={handleEscape}
      />
      {trimmed && (
        <div className={classes.hint} aria-live="polite">
          {effectiveRoute === 'Qurator' ? (
            <>
              <M.Icon className={classes.hintIcon}>auto_awesome</M.Icon>
              Looks like a question — <b>Qurator</b> will plan &amp; answer it.{' '}
              <span className={classes.kbd}>Enter</span> to run
            </>
          ) : (
            <>
              <M.Icon className={classes.hintIcon}>search</M.Icon>
              Searching <b>packages, objects &amp; tables</b> across all buckets.{' '}
              <span className={classes.kbd}>Enter</span> to open results
            </>
          )}
        </div>
      )}
      {effectiveRoute === 'Search' ? (
        // SearchSuggestions reads `useRelevantBuckets`, which always suspends
        // (see utils/Buckets). `classifyQuery('')` is 'Search', so this mounts on
        // page LOAD, not first on a keystroke -- a cold visit suspends here
        // immediately. Without a boundary React unwinds to the nearest one above,
        // and all of those sit above the component holding `query`
        // (FrontDoorContent): the whole front door would be replaced by the
        // app-level Placeholder and remounted, taking any typed text with it.
        //
        // The boundary sits *below* the Input rather than around the whole bar
        // on purpose: suspending must not unmount the field, or the caret and
        // focus would be lost even though the value survived.
        <React.Suspense fallback={<SuggestionsPlaceholder />}>
          <SearchSuggestions
            ref={suggestionsRef}
            query={value}
            quratorEnabled={quratorEnabled}
            onAskQurator={runQurator}
            listId={SUGGESTIONS_ID}
            highlight={highlight}
            onRowCount={handleRowCount}
          />
        </React.Suspense>
      ) : (
        <QuratorPanel
          query={trimmed}
          onRun={runQurator}
          onJustSearch={() => setForceSearch(true)}
        />
      )}
    </div>
  )
}
