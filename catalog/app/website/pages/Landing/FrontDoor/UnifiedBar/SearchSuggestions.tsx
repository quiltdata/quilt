import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import { bucketAthena, search } from 'constants/routes'
import { useRelevantBuckets } from 'utils/Buckets'

import useUnifiedSuggestions from '../useUnifiedSuggestions'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.common.white,
    borderRadius: 14,
    border: t.palette.type === 'dark' ? 'none' : '1px solid rgba(40,43,80,.12)',
    boxShadow:
      t.palette.type === 'dark'
        ? '0 24px 70px -18px rgba(0,0,0,.5)'
        : '0 18px 50px -18px rgba(40,43,80,.3)',
    color: '#282b50',
    marginTop: t.spacing(1.75),
    overflow: 'hidden',
  },
  meta: {
    background: '#f4f6fc',
    borderBottom: '1px solid #e9ecf5',
    color: '#6a7090',
    display: 'flex',
    fontSize: 12.5,
    gap: t.spacing(2),
    padding: t.spacing(1.25, 2.5),
    '& b': {
      color: '#282b50',
    },
  },
  scopeIcon: {
    color: t.palette.secondary.main,
  },
  where: {
    color: '#8a90a6',
    fontSize: 13,
    marginLeft: 'auto',
  },
  askRow: {
    background: 'linear-gradient(90deg,rgba(84,113,241,.1),rgba(106,147,255,.03))',
    borderTop: `1px solid #eef0f6`,
  },
  askIcon: {
    color: t.palette.secondary.main,
  },
  askWhere: {
    color: t.palette.secondary.main,
    fontSize: 13,
    fontWeight: 500,
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

  // The Athena/Tabulator UI is bucket-scoped — there is no global Athena page —
  // so the "tables" row targets the most relevant bucket's Athena query editor.
  const athenaBucket = buckets[0]?.name

  const goScope = React.useCallback(
    (scopeId: string) => {
      if (!trimmed) return
      switch (scopeId) {
        case 'tables':
          // The Athena editor is bucket-scoped; fall back to search if no bucket.
          history.push(
            athenaBucket ? bucketAthena.url(athenaBucket) : search.url({ q: trimmed }),
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
    { id: 'packages', icon: 'inventory_2', label: 'packages', where: 'all volumes' },
    { id: 'objects', icon: 'description', label: 'objects', where: 'all volumes' },
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
          <span className={classes.where}>across all volumes</span>
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
