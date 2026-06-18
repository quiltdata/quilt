import cx from 'classnames'
import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'

// Schema-free generic async-state helpers; they merely live under the Athena
// folder. Candidate for relocation to a neutral `utils/` location.
import * as Model from '../../Queries/Athena/model/utils'
import { useTabulatorTables } from '../../Tabulator/requests'
import type { ParsedTabulatorTable } from '../../Tabulator/requests'

import SectionTitle from './SectionTitle'

const useRowStyles = M.makeStyles((t) => ({
  root: {
    borderTop: `1px solid ${t.palette.divider}`,
  },
  header: {
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(1.5, 2),
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
    fontWeight: t.typography.fontWeightMedium,
  },
  meta: {
    color: t.palette.text.secondary,
    whiteSpace: 'nowrap',
  },
  source: {
    color: t.palette.text.secondary,
    cursor: 'help',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.8rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textDecoration: 'underline dotted',
    whiteSpace: 'nowrap',
  },
  tip: {
    whiteSpace: 'pre-line',
  },
  body: {
    padding: t.spacing(1, 2, 2, 5),
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
        {!!table.format && <M.Chip size="small" label={table.format} />}
        <span className={classes.meta}>{table.columns.length} cols</span>
        {sourceText && (
          <M.Tooltip title={<span className={classes.tip}>{sourceTitle}</span>}>
            <span className={classes.source}>{sourceText}</span>
          </M.Tooltip>
        )}
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
    paddingTop: t.spacing(2),
  },
  head: {
    alignItems: 'baseline',
    display: 'flex',
    justifyContent: 'space-between',
    padding: t.spacing(0, 2),
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
  const tables = useTabulatorTables(bucket)

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
        <SectionTitle>
          Tabulator tables
          <span className={classes.count}>
            {' · '}
            {tables.length} in {bucket}
          </span>
        </SectionTitle>
        <M.Button component={RRLink} to={queryUrl} size="small" color="primary">
          More queries
        </M.Button>
      </div>
      <div>
        {tables.map((table) => (
          <TableRow key={table.name} table={table} athenaUrl={athenaUrl} />
        ))}
      </div>
    </M.Paper>
  )
}
