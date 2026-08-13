import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import { queriesAthena, search } from 'constants/routes'
import { useRelevantBuckets } from 'utils/Buckets'

import useUnifiedSuggestions from '../useUnifiedSuggestions'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(1.75),
    overflow: 'hidden',
  },
  meta: {
    background: t.palette.action.hover,
    borderBottom: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: 12.5,
    gap: t.spacing(2),
    padding: t.spacing(1.25, 2.5),
    '& b': {
      color: t.palette.text.primary,
    },
  },
  scopeIcon: {
    color: t.palette.text.secondary,
  },
  where: {
    color: t.palette.text.secondary,
    fontSize: 13,
    marginLeft: 'auto',
  },
  // The one row that changes destination rather than scope, so it's the one row
  // that carries the Indicator.
  askRow: {
    background: fade(t.palette.secondary.main, 0.08),
    borderTop: `1px solid ${t.palette.divider}`,
  },
  askIcon: {
    color: t.palette.secondary.main,
  },
  askWhere: {
    color: t.palette.text.secondary,
    fontSize: 13,
    fontWeight: t.typography.fontWeightMedium,
    marginLeft: 'auto',
  },
}))

interface SearchSuggestionsProps {
  query: string
  quratorEnabled: boolean
  onAskQurator: () => void
}

export default function SearchSuggestions({
  query,
  quratorEnabled,
  onAskQurator,
}: SearchSuggestionsProps) {
  const classes = useStyles()
  const history = useHistory()
  const suggestions = useUnifiedSuggestions(query)
  const buckets = useRelevantBuckets()
  const trimmed = query.trim()

  // Tabulator tables are bucket-scoped even though the query console isn't, so
  // the "tables" row opens the console pointed at the most relevant bucket.
  const athenaBucket = buckets[0]?.name

  const goScope = React.useCallback(
    (scopeId: string) => {
      if (!trimmed) return
      switch (scopeId) {
        case 'tables':
          history.push(
            athenaBucket
              ? queriesAthena.url({ bucket: athenaBucket })
              : search.url({ q: trimmed }),
          )
          return
        case 'objects':
          // Objects live on the global search page with the S3Object result type (t=o).
          history.push(`${search.url({ q: trimmed })}&t=o`)
          return
        default:
          history.push(search.url({ q: trimmed }))
      }
    },
    [athenaBucket, history, trimmed],
  )

  if (!trimmed && !suggestions.length) return null

  const scopes: { id: string; icon: string; label: string; where: string }[] = [
    { id: 'packages', icon: 'inventory_2', label: 'packages', where: 'all buckets' },
    { id: 'objects', icon: 'description', label: 'objects', where: 'all buckets' },
    {
      id: 'tables',
      icon: 'table_chart',
      label: 'tables',
      where: athenaBucket ? `Athena · ${athenaBucket}` : 'Tabulator · Athena',
    },
  ]

  return (
    <M.Paper className={classes.root} elevation={0}>
      {trimmed && (
        <div className={classes.meta} aria-label="Search scope">
          <span>
            Search <b>packages, objects &amp; tables</b>
          </span>
          <span className={classes.where}>across all buckets</span>
        </div>
      )}
      <M.List dense aria-label="Search suggestions" disablePadding>
        {trimmed &&
          scopes.map((scope) => (
            <M.ListItem button key={scope.id} onClick={() => goScope(scope.id)}>
              <M.ListItemIcon>
                <M.Icon className={classes.scopeIcon}>{scope.icon}</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText
                primary={
                  <span>
                    «<b>{trimmed}</b>» in <b>{scope.label}</b>
                  </span>
                }
              />
              <span className={classes.where}>{scope.where}</span>
            </M.ListItem>
          ))}
        {suggestions.map((suggestion) => (
          <M.ListItem
            key={suggestion.id}
            button
            component={suggestion.url ? 'a' : 'div'}
            href={suggestion.url}
          >
            <M.ListItemIcon>
              <M.Icon>bookmark</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary={suggestion.label} secondary={suggestion.detail} />
          </M.ListItem>
        ))}
        {quratorEnabled && trimmed && (
          <M.ListItem button className={classes.askRow} onClick={onAskQurator}>
            <M.ListItemIcon>
              <M.Icon className={classes.askIcon}>auto_awesome</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary={`Ask Qurator about “${trimmed}” instead`} />
            <span className={classes.askWhere}>natural language →</span>
          </M.ListItem>
        )}
      </M.List>
    </M.Paper>
  )
}
