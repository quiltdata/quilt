import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import { search } from 'constants/routes'
import { Model as AssistantModel } from 'components/Assistant'
// The same classifier the header's SearchBar submits through, so the front door
// and the header can't disagree about what counts as a question.
import { classifyQuery } from 'components/SearchBar/classify'

import Input from './Input'
import QuratorPanel from './QuratorPanel'
import SearchSuggestions from './SearchSuggestions'

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
}))

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

  const submit = React.useCallback(() => {
    if (effectiveRoute === 'Search') submitSearch()
    else runQurator()
  }, [effectiveRoute, runQurator, submitSearch])

  const handleChange = React.useCallback(
    (next: string) => {
      setForceSearch(false)
      onChange(next)
    },
    [onChange],
  )

  return (
    <div className={classes.root}>
      <Input
        route={effectiveRoute}
        showRouteBadge={quratorEnabled}
        value={value}
        onChange={handleChange}
        onSubmit={submit}
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
        <SearchSuggestions
          query={value}
          quratorEnabled={quratorEnabled}
          onAskQurator={runQurator}
        />
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
