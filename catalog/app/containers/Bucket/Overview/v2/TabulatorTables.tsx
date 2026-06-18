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
import TabulatorSchemaDialog from './TabulatorSchemaDialog'

// Keep the inline column preview compact; the full list is in the schema dialog.
const MAX_PREVIEW_COLUMNS = 6

const useRowStyles = M.makeStyles((t) => ({
  root: {
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(1.5, 2),
  },
  top: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1.5),
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
  actions: {
    display: 'flex',
    gap: t.spacing(1),
    marginLeft: 'auto',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
    marginTop: t.spacing(1),
  },
  chipType: {
    color: t.palette.text.hint,
    fontFamily: t.typography.monospace.fontFamily,
    marginLeft: t.spacing(0.5),
  },
  tip: {
    whiteSpace: 'pre-line',
  },
}))

interface TableRowProps {
  table: ParsedTabulatorTable
  queryUrl: string
  onPreview: (table: ParsedTabulatorTable) => void
}

function TableRow({ table, queryUrl, onPreview }: TableRowProps) {
  const classes = useRowStyles()
  const shownColumns = table.columns.slice(0, MAX_PREVIEW_COLUMNS)
  const extra = table.columns.length - shownColumns.length
  const sourceText = table.source
    ? `${table.source.packageName.pretty} · ${table.source.logicalKey.pretty}`
    : null
  const sourceTitle = table.source
    ? `package_name: ${table.source.packageName.raw}\nlogical_key: ${table.source.logicalKey.raw}`
    : ''
  return (
    <div className={classes.root}>
      <div className={classes.top}>
        <span className={classes.name}>{table.name}</span>
        {!!table.format && <M.Chip size="small" label={table.format} />}
        <span className={classes.meta}>{table.columns.length} cols</span>
        {sourceText && (
          <M.Tooltip title={<span className={classes.tip}>{sourceTitle}</span>}>
            <span className={classes.source}>{sourceText}</span>
          </M.Tooltip>
        )}
        <span className={classes.actions}>
          <M.Button size="small" variant="outlined" onClick={() => onPreview(table)}>
            Preview
          </M.Button>
          <M.Button
            size="small"
            variant="contained"
            color="primary"
            component={RRLink}
            to={queryUrl}
          >
            Query
          </M.Button>
        </span>
      </div>
      <div className={classes.chips}>
        {shownColumns.map((col) => (
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
        {extra > 0 && (
          <M.Chip
            size="small"
            variant="outlined"
            clickable
            onClick={() => onPreview(table)}
            label={`+${extra} more`}
          />
        )}
      </div>
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
  const [selected, setSelected] = React.useState<ParsedTabulatorTable | null>(null)

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
          <TableRow
            key={table.name}
            table={table}
            queryUrl={queryUrl}
            onPreview={setSelected}
          />
        ))}
      </div>
      <TabulatorSchemaDialog
        bucket={bucket}
        table={selected}
        onClose={() => setSelected(null)}
      />
    </M.Paper>
  )
}
