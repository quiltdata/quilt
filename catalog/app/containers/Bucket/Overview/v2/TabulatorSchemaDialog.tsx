import * as React from 'react'
import { Link as RRLink } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import copyToClipboard from 'utils/clipboard'

import type { ParsedTabulatorTable } from '../../Tabulator/requests'

const useStyles = M.makeStyles((t) => ({
  subhead: {
    marginTop: t.spacing(0.5),
  },
  sql: {
    alignItems: 'center',
    background: t.palette.grey[100],
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.8rem',
    gap: t.spacing(1),
    justifyContent: 'space-between',
    margin: t.spacing(2, 0, 1),
    padding: t.spacing(1, 1.5),
    wordBreak: 'break-all',
  },
  type: {
    color: t.palette.text.hint,
    fontFamily: t.typography.monospace.fontFamily,
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  format: {
    marginLeft: t.spacing(1),
  },
}))

interface TabulatorSchemaDialogProps {
  bucket: string
  table: ParsedTabulatorTable | null
  onClose: () => void
}

export default function TabulatorSchemaDialog({
  bucket,
  table,
  onClose,
}: TabulatorSchemaDialogProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { push } = Notifications.use()

  // Keep the last non-null table so content stays put during the close transition.
  const [shown, setShown] = React.useState<ParsedTabulatorTable | null>(table)
  React.useEffect(() => {
    if (table) setShown(table)
  }, [table])

  // 2-part "database"."table" name: the bucket is the database. Tabulator tables
  // live in a custom Athena data catalog ("<stack>-tabulator" by convention), not
  // the default AwsDataCatalog. The catalog is omitted here — its name is not in
  // the table config, and resolving it would require an Athena ListDataCatalogs
  // call. The query works when the Tabulator catalog is the active catalog (as on
  // the linked Queries page).
  const sql = shown ? `SELECT * FROM "${bucket}"."${shown.name}" LIMIT 100` : ''

  const handleCopy = React.useCallback(() => {
    copyToClipboard(sql)
    push('Query has been copied to clipboard')
  }, [sql, push])

  return (
    <M.Dialog open={!!table} onClose={onClose} maxWidth="sm" fullWidth>
      {shown && (
        <>
          <M.DialogTitle disableTypography>
            <M.Typography variant="h6">
              {shown.name}
              {!!shown.format && (
                <M.Chip className={classes.format} size="small" label={shown.format} />
              )}
            </M.Typography>
            <M.Typography
              className={classes.subhead}
              variant="body2"
              color="textSecondary"
            >
              {shown.columns.length} columns
              {shown.source &&
                ` · ${shown.source.packageName.pretty} · ${shown.source.logicalKey.pretty}`}
            </M.Typography>
          </M.DialogTitle>
          <M.DialogContent>
            <M.Table size="small">
              <M.TableBody>
                {shown.columns.map((col) => (
                  <M.TableRow key={col.name}>
                    <M.TableCell>{col.name}</M.TableCell>
                    <M.TableCell className={classes.type}>{col.type}</M.TableCell>
                  </M.TableRow>
                ))}
              </M.TableBody>
            </M.Table>
            <div className={classes.sql}>
              <span>{sql}</span>
              <M.IconButton onClick={handleCopy} title="Copy query" size="small">
                <M.Icon fontSize="small">content_copy</M.Icon>
              </M.IconButton>
            </div>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={onClose}>Close</M.Button>
            <M.Button component={RRLink} to={urls.bucketQueries(bucket)} color="primary">
              Open in Queries
            </M.Button>
          </M.DialogActions>
        </>
      )}
    </M.Dialog>
  )
}
