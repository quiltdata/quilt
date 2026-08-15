import * as React from 'react'
import { useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import { queriesAthena, search } from 'constants/routes'
import { useRelevantBuckets } from 'utils/Buckets'

import useUnifiedSuggestions from '../useUnifiedSuggestions'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    marginTop: t.spacing(2),
    overflow: 'hidden',
  },
  meta: {
    background: t.palette.action.hover,
    borderBottom: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: t.typography.caption.fontSize,
    gap: t.spacing(2),
    padding: t.spacing(1, 2),
    '& b': {
      color: t.palette.text.primary,
    },
  },
  scopeIcon: {
    color: t.palette.text.secondary,
  },
  where: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    marginLeft: 'auto',
  },
  // The one row that changes destination rather than scope. Its separation is
  // carried by the rule above it and a neutral ground; the Indicator is the
  // amber glyph, which is a mark, not a wash.
  askRow: {
    background: t.palette.action.hover,
    borderTop: `1px solid ${t.palette.divider}`,
  },
  askIcon: {
    color: t.palette.secondary.main,
  },
  askWhere: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    marginLeft: 'auto',
  },
}))

// A stable id per row so the field's `aria-activedescendant` can name the
// highlighted one. Exported so the two stay in lockstep -- if they disagree, the
// announcement silently points at nothing.
export const suggestionOptionId = (listId: string, index: number) =>
  `${listId}-option-${index}`

// The one thing the field can't get as data: committing a row, so that Enter on
// a highlighted row does exactly what clicking it does. The row *count* travels
// the other way, through `onRowCount`, because the field needs it during render.
export interface SearchSuggestionsHandle {
  activate: (index: number) => void
}

interface SearchSuggestionsProps {
  query: string
  quratorEnabled: boolean
  onAskQurator: () => void
  listId?: string
  // -1 when nothing is highlighted, which is the resting state: the bar's own
  // route still owns Enter until the user arrows into a row.
  highlight?: number
  // How many rows are on screen. The field needs this at *render* time to tell
  // the truth about `aria-expanded`, and a ref can't carry it: the ref is still
  // null on the field's first paint and mutating it later re-renders nothing.
  onRowCount?: (count: number) => void
}

export default React.forwardRef<SearchSuggestionsHandle, SearchSuggestionsProps>(
  function SearchSuggestions(
    {
      query,
      quratorEnabled,
      onAskQurator,
      listId = 'front-door-suggestions',
      highlight = -1,
      onRowCount,
    },
    ref,
  ) {
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

    // One array drives both what is drawn and what Enter commits. Two lists here
    // (one to render, one to index into) is how an off-by-one ships: the highlight
    // would name one row and activate another.
    interface Row {
      key: string
      icon: string
      iconClass?: string
      primary: React.ReactNode
      secondary?: string
      where?: string
      whereClass?: string
      rowClass?: string
      href?: string
      activate: () => void
    }

    const rows: Row[] = [
      ...(trimmed
        ? scopes.map((scope) => ({
            key: `scope-${scope.id}`,
            icon: scope.icon,
            iconClass: classes.scopeIcon,
            primary: (
              <span>
                «<b>{trimmed}</b>» in <b>{scope.label}</b>
              </span>
            ),
            where: scope.where,
            whereClass: classes.where,
            activate: () => goScope(scope.id),
          }))
        : []),
      ...suggestions.map((suggestion) => ({
        key: suggestion.id,
        icon: 'bookmark',
        primary: suggestion.label,
        secondary: suggestion.detail,
        href: suggestion.url,
        // Keep the real href for middle-click and "open in new tab", but route the
        // ordinary activation through the router so it doesn't reload the app.
        activate: () => {
          if (suggestion.url) history.push(suggestion.url)
        },
      })),
      ...(quratorEnabled && trimmed
        ? [
            {
              key: 'ask-qurator',
              icon: 'auto_awesome',
              iconClass: classes.askIcon,
              primary: `Ask Qurator about “${trimmed}” instead`,
              where: 'natural language →',
              whereClass: classes.askWhere,
              rowClass: classes.askRow,
              activate: onAskQurator,
            },
          ]
        : []),
    ]

    // Keep the latest rows reachable from a handle whose identity never changes:
    // the array is rebuilt every render, so closing over it directly would either
    // go stale or re-issue the handle on every keystroke.
    const rowsRef = React.useRef(rows)
    rowsRef.current = rows

    React.useImperativeHandle(
      ref,
      () => ({
        activate: (index: number) => rowsRef.current[index]?.activate(),
      }),
      [],
    )

    // Depend on the count, not the array: `rows` is rebuilt every render, so the
    // array identity would fire this on every keystroke and loop through the
    // parent's setState.
    React.useEffect(() => {
      if (onRowCount) onRowCount(rows.length)
    }, [onRowCount, rows.length])

    // rows is empty exactly when this returns null, so the count reported above is
    // always "options currently on screen" -- which is what `aria-expanded` claims.
    if (!trimmed && !suggestions.length) return null

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
        {/* listbox, not a plain list: this is a combobox popup, so the highlight
          has to be exposed as `aria-selected` and each row named by an id the
          field can point at. */}
        <M.List
          dense
          aria-label="Search suggestions"
          disablePadding
          id={listId}
          role="listbox"
        >
          {rows.map((row, index) => (
            <M.ListItem
              aria-selected={highlight === index}
              button
              className={row.rowClass}
              id={suggestionOptionId(listId, index)}
              key={row.key}
              role="option"
              selected={highlight === index}
              {...(row.href
                ? { component: 'a' as const, href: row.href }
                : { component: 'div' as const })}
              onClick={(event: React.MouseEvent) => {
                if (row.href) event.preventDefault()
                row.activate()
              }}
            >
              <M.ListItemIcon>
                <M.Icon className={row.iconClass}>{row.icon}</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText primary={row.primary} secondary={row.secondary} />
              {row.where && <span className={row.whereClass}>{row.where}</span>}
            </M.ListItem>
          ))}
        </M.List>
      </M.Paper>
    )
  },
)
