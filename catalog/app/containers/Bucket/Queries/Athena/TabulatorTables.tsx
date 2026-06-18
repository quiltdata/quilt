import * as React from 'react'
import * as M from '@material-ui/core'

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

export default function TabulatorTables() {
  const classes = useStyles()
  const { bucket, queryBody, catalogName, catalogNames, database } = Model.use()
  const tables = useTabulatorTables(bucket)

  const handleSelect = React.useCallback(
    (table: ParsedTabulatorTable) => {
      const catalog = Model.hasData(catalogNames.data)
        ? resolveTabulatorCatalog(catalogNames.data.list)
        : undefined
      // Three-part, fully-qualified name runs regardless of the selected context;
      // fall back to two parts when the tabulator catalog can't be resolved yet.
      const sql = catalog
        ? `SELECT * FROM "${catalog}"."${bucket}"."${table.name}" LIMIT 100`
        : `SELECT * FROM "${bucket}"."${table.name}" LIMIT 100`
      queryBody.setValue(sql)
      if (catalog) {
        catalogName.setValue(catalog)
        database.setValue(bucket)
      }
    },
    [bucket, catalogNames.data, queryBody, catalogName, database],
  )

  // Render nothing on loading / error / empty — never break the Queries page.
  if (!Model.hasData(tables) || tables.length === 0) return null

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
