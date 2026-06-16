import * as React from 'react'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

// Schema-free generic async-state helpers; they merely live under the Athena
// folder. Candidate for relocation to a neutral `utils/` location.
import * as Model from '../../Queries/Athena/model/utils'
import type { QueryResults } from '../../Queries/Athena/model/requests'
import { useTabulatorTables, useTablePreview } from '../../Tabulator/requests'

import SectionTitle from './SectionTitle'

// Keep the inline preview compact; the user can open the full Queries page for more.
const MAX_PREVIEW_COLUMNS = 12

const usePreviewStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0, 2, 2),
  },
  tableWrapper: {
    maxHeight: t.spacing(40),
    overflow: 'auto',
  },
  cell: {
    maxWidth: t.spacing(30),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

interface PreviewBodyProps {
  results: Model.Data<QueryResults>
}

function PreviewBody({ results }: PreviewBodyProps) {
  const classes = usePreviewStyles()

  if (Model.isLoading(results) || Model.isNone(results)) {
    return <M.LinearProgress />
  }

  if (Model.isError(results)) {
    return (
      <M.Typography color="error" variant="body2" className={classes.root}>
        {results.message || 'Could not load preview'}
      </M.Typography>
    )
  }

  if (!Model.hasData(results) || results.rows.length === 0) {
    return (
      <M.Typography color="textSecondary" variant="body2" className={classes.root}>
        No rows
      </M.Typography>
    )
  }

  const columns = results.columns.slice(0, MAX_PREVIEW_COLUMNS)
  return (
    <div className={classes.root}>
      <M.Paper variant="outlined" className={classes.tableWrapper}>
        <M.Table size="small" stickyHeader>
          <M.TableHead>
            <M.TableRow>
              {columns.map((col, i) => (
                <M.TableCell key={`${col.name}-${i}`}>{col.name}</M.TableCell>
              ))}
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {results.rows.map((row, ri) => (
              // eslint-disable-next-line react/no-array-index-key
              <M.TableRow key={ri}>
                {columns.map((_col, ci) => (
                  <M.TableCell key={ci} className={classes.cell} title={row[ci] ?? ''}>
                    {row[ci] ?? ''}
                  </M.TableCell>
                ))}
              </M.TableRow>
            ))}
          </M.TableBody>
        </M.Table>
      </M.Paper>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(2),
  },
  title: {
    padding: t.spacing(0, 2),
  },
  footer: {
    padding: t.spacing(1, 2),
    textAlign: 'right',
  },
}))

interface TabulatorTablesProps {
  bucket: string
}

export default function TabulatorTables({ bucket }: TabulatorTablesProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const tables = useTabulatorTables(bucket)
  const { preview, open } = useTablePreview(bucket)

  if (Model.isLoading(tables)) return <M.LinearProgress />

  if (Model.isError(tables)) {
    return (
      <M.Typography color="textSecondary" variant="body2">
        Could not load Tabulator tables
      </M.Typography>
    )
  }

  if (!Model.hasData(tables) || tables.length === 0) return null

  return (
    <M.Paper className={classes.root}>
      <div className={classes.title}>
        <SectionTitle>Tabulator tables</SectionTitle>
      </div>
      <M.List>
        {tables.map((table) => {
          const isOpen = preview?.table === table.name
          return (
            <React.Fragment key={table.name}>
              <M.ListItem button onClick={() => open(table.name)}>
                <M.ListItemText primary={table.name} />
                {isOpen ? <M.Icon>expand_less</M.Icon> : <M.Icon>expand_more</M.Icon>}
              </M.ListItem>
              <M.Collapse in={isOpen} timeout="auto" unmountOnExit>
                {isOpen && <PreviewBody results={preview!.results} />}
              </M.Collapse>
            </React.Fragment>
          )
        })}
      </M.List>
      <div className={classes.footer}>
        <StyledLink to={urls.bucketQueries(bucket)}>More queries</StyledLink>
      </div>
    </M.Paper>
  )
}
