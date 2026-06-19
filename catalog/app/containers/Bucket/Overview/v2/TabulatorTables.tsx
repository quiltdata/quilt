import cx from 'classnames'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'

// Schema-free generic async-state helpers; they merely live under the Athena
// folder. Candidate for relocation to a neutral `utils/` location.
import * as Model from '../../Queries/Athena/model/utils'
import { useTabulatorTables } from '../../Tabulator/requests'
import type { ParsedTabulatorTable } from '../../Tabulator/requests'

import SectionHeader from './SectionHeader'

const useRowStyles = M.makeStyles((t) => ({
  root: {
    borderTop: `1px solid ${t.palette.divider}`,
  },
  header: {
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(1.5),
    // Row owns its horizontal padding so the divider (on `root`) spans the full
    // card width while the content stays inset.
    padding: t.spacing(1.5, 3),
    '&:hover': {
      background: t.palette.action.hover,
    },
  },
  caret: {
    color: t.palette.text.secondary,
    transition: 'transform 0.15s ease',
  },
  caretOpen: {
    transform: 'rotate(90deg)',
  },
  name: {
    flexShrink: 0,
    fontWeight: t.typography.fontWeightMedium,
  },
  // Metadata clustered on the right: source (variable) · cols (fixed) · format (fixed).
  meta: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(2),
    marginLeft: 'auto',
    minWidth: 0,
  },
  source: {
    color: t.palette.text.secondary,
    cursor: 'help',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.8rem',
    textDecoration: 'underline dotted',
    whiteSpace: 'nowrap',
  },
  cols: {
    color: t.palette.text.secondary,
    flexShrink: 0,
    textAlign: 'right',
    whiteSpace: 'nowrap',
    width: 56,
  },
  format: {
    flexShrink: 0,
    textAlign: 'right',
    width: 72,
  },
  tip: {
    whiteSpace: 'pre-line',
  },
  body: {
    // Indent under the row name (past the caret); right padding matches the row.
    padding: t.spacing(1, 3, 2, 7),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
  chipType: {
    color: t.palette.text.hint,
    fontFamily: t.typography.monospace.fontFamily,
    marginLeft: t.spacing(0.5),
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: t.spacing(2),
  },
}))

interface TableRowProps {
  table: ParsedTabulatorTable
  athenaUrl: string
}

function TableRow({ table, athenaUrl }: TableRowProps) {
  const classes = useRowStyles()
  const [expanded, setExpanded] = React.useState(false)

  const sourceText = table.source
    ? `${table.source.packageName.pretty} · ${table.source.logicalKey.pretty}`
    : null
  const sourceTitle = table.source
    ? `package_name: ${table.source.packageName.raw}\nlogical_key: ${table.source.logicalKey.raw}`
    : ''

  const toggle = React.useCallback(() => setExpanded((e) => !e), [])
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        toggle()
      }
    },
    [toggle],
  )

  return (
    <div className={classes.root}>
      <div
        className={classes.header}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
      >
        <M.Icon
          className={cx(classes.caret, expanded && classes.caretOpen)}
          fontSize="small"
        >
          chevron_right
        </M.Icon>
        <span className={classes.name}>{table.name}</span>
        <div className={classes.meta}>
          {sourceText && (
            <M.Tooltip title={<span className={classes.tip}>{sourceTitle}</span>}>
              <span className={classes.source}>{sourceText}</span>
            </M.Tooltip>
          )}
          <span className={classes.cols}>{table.columns.length} cols</span>
          <span className={classes.format}>
            {!!table.format && <M.Chip size="small" label={table.format} />}
          </span>
        </div>
      </div>
      <M.Collapse in={expanded} unmountOnExit>
        <div className={classes.body}>
          <div className={classes.chips}>
            {table.columns.map((col) => (
              <M.Chip
                key={col.name}
                size="small"
                variant="outlined"
                label={
                  <>
                    {col.name}
                    <span className={classes.chipType}>{col.type}</span>
                  </>
                }
              />
            ))}
          </div>
          <div className={classes.actions}>
            <M.Button
              size="small"
              variant="contained"
              color="primary"
              component={RRLink}
              to={{
                pathname: athenaUrl,
                search: `?table=${encodeURIComponent(table.name)}`,
              }}
            >
              Query →
            </M.Button>
          </div>
        </div>
      </M.Collapse>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
  },
  // Rows bleed to full width for edge-to-edge dividers; the header gets the
  // padding the card body would otherwise provide.
  head: {
    padding: t.spacing(3, 3, 0),
  },
  count: {
    color: t.palette.text.secondary,
    fontWeight: t.typography.fontWeightRegular,
  },
}))

interface TabulatorTablesProps {
  bucket: string
}

export default function TabulatorTables({ bucket }: TabulatorTablesProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { prefs } = BucketPreferences.use()
  const tables = useTabulatorTables(bucket)

  // The whole section links into the Queries tab, so respect a bucket that has
  // disabled it via `ui.nav.queries`.
  const queriesEnabled = BucketPreferences.Result.match(
    { Ok: ({ ui: { nav } }) => nav.queries, _: () => false },
    prefs,
  )
  if (!queriesEnabled) return null

  if (Model.isLoading(tables)) return <M.LinearProgress />

  if (Model.isError(tables)) {
    return (
      <M.Typography color="textSecondary" variant="body2">
        Could not load Tabulator tables
      </M.Typography>
    )
  }

  if (!Model.hasData(tables) || tables.length === 0) return null

  const queryUrl = urls.bucketQueries(bucket)
  const athenaUrl = urls.bucketAthena(bucket)
  return (
    <M.Paper className={classes.root}>
      <div className={classes.head}>
        <SectionHeader
          action={
            <M.Button component={RRLink} to={queryUrl} size="small" color="primary">
              More queries
            </M.Button>
          }
        >
          Tabulator tables
          <span className={classes.count}>
            {' · '}
            {tables.length} in {bucket}
          </span>
        </SectionHeader>
      </div>
      <div>
        {tables.map((table) => (
          <TableRow key={table.name} table={table} athenaUrl={athenaUrl} />
        ))}
      </div>
    </M.Paper>
  )
}
