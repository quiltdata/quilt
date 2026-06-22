import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Notifications from 'containers/Notifications'

import type { ParsedTabulatorTable } from '../../Tabulator/requests'
import { useTabulatorTables, resolveTabulatorCatalog } from '../../Tabulator/requests'
import * as Model from './model'

const useStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(3, 0, 0),
  },
  label: {
    marginBottom: t.spacing(1),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
  },
}))

// Athena/Presto identifier quoting: double any embedded `"`.
const quoteIdent = (s: string) => s.replace(/"/g, '""')

export default function TabulatorTables() {
  const classes = useStyles()
  const { bucket, queryBody, catalogName, catalogNames, database } = Model.use()
  const { push } = Notifications.use()
  const tablesResult = useTabulatorTables(bucket)
  const tables = tablesResult._tag === 'ready' ? tablesResult.tables : undefined

  const handleSelect = React.useCallback(
    (table: ParsedTabulatorTable) => {
      const catalog = Model.hasData(catalogNames.data)
        ? resolveTabulatorCatalog(catalogNames.data.list)
        : undefined
      // Three-part, fully-qualified name runs regardless of the selected context;
      // fall back to two parts when the tabulator catalog can't be resolved yet.
      const sql = catalog
        ? `SELECT * FROM "${quoteIdent(catalog)}"."${quoteIdent(bucket)}"."${quoteIdent(
            table.name,
          )}" LIMIT 100`
        : `SELECT * FROM "${quoteIdent(bucket)}"."${quoteIdent(table.name)}" LIMIT 100`
      queryBody.setValue(sql)
      if (catalog) {
        catalogName.setValue(catalog)
        database.setValue(bucket)
      }
    },
    [bucket, catalogNames.data, queryBody, catalogName, database],
  )

  // Deep link from the Overview: `?table=<name>` autofills that table once on load,
  // reusing the same handler as a chip click, then the param is consumed so edits
  // and reloads aren't re-seeded.
  const location = RRDom.useLocation()
  const history = RRDom.useHistory()
  const appliedRef = React.useRef(false)
  React.useEffect(() => {
    if (appliedRef.current) return
    if (!tables) return
    // Wait until the catalog list settles so the autofill can build the 3-part name.
    if (!Model.hasData(catalogNames.data) && !Model.isError(catalogNames.data)) return
    const params = new URLSearchParams(location.search)
    const name = params.get('table')
    if (!name) return
    appliedRef.current = true
    const table = tables.find((t) => t.name === name)
    if (table) handleSelect(table)
    else push(`Table "${name}" not found`)
    params.delete('table')
    history.replace({ ...location, search: params.toString() })
  }, [tables, catalogNames.data, location, history, handleSelect, push])

  // Render nothing on loading / error / empty — never break the Queries page.
  if (!tables || tables.length === 0) return null

  // An optional shortcut that fills the editor, not a step in the form — hence the
  // muted, action-led framing rather than a labelled field. Clicking replaces the
  // current query body (the editor is usually pre-filled with the default query).
  return (
    <div className={classes.root}>
      <M.Typography className={classes.label} variant="body2" color="textSecondary">
        Autofill the query from a Tabulator table:
      </M.Typography>
      <div className={classes.chips}>
        {tables.map((table) => (
          <M.Tooltip
            key={table.name}
            title={`${table.columns.length} columns${
              table.source ? ` · ${table.source.packageName.pretty}` : ''
            }`}
          >
            <M.Chip label={table.name} clickable onClick={() => handleSelect(table)} />
          </M.Tooltip>
        ))}
      </div>
    </div>
  )
}
