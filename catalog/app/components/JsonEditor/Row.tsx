import cx from 'classnames'
import * as React from 'react'
import * as RTable from 'react-table'
import * as M from '@material-ui/core'

import * as JSONPointer from 'utils/JSONPointer'

import type { JsonSchema } from 'utils/JSONSchema'

import { COLUMN_IDS, EditorMode, RowData } from './constants'

const useStyles = M.makeStyles((t) => ({
  cell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
  },
  error: {
    borderColor: t.palette.error.main,
  },
  key: {
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(27),
    },
  },
  value: {
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(40),
    },
  },
  // property mode: a red wash says "needs a fix" on the value itself, not only the border
  errorValue: {
    background: t.palette.error.light + '1f',
  },
  meta: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    padding: t.spacing(0.5, 1),
    whiteSpace: 'nowrap',
  },
  about: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    padding: t.spacing(0.5, 1),
  },
  required: {
    color: t.palette.error.dark,
    marginLeft: 2,
  },
}))

/** A short type label from the schema, as the property grid shows it. */
export function typeLabel(schema?: JsonSchema) {
  if (!schema) return ''
  if (Array.isArray(schema.enum)) return 'choice'
  const types = (Array.isArray(schema.type) ? schema.type : [schema.type]).filter(
    (x: unknown) => x && x !== 'null',
  )
  if (types.length !== 1) return types.length ? 'mixed' : ''
  if (types[0] === 'string' && schema.format === 'date') return 'date'
  if (types[0] === 'array') return 'list'
  return String(types[0])
}

interface RowProps {
  cells: RTable.Cell<RowData>[]
  columnPath: JSONPointer.Path
  contextMenuPath: JSONPointer.Path
  fresh: boolean
  mode?: EditorMode
  onContextMenu: (path: JSONPointer.Path) => void
  onExpand: (path: JSONPointer.Path) => void
  onRemove: (path: JSONPointer.Path) => void
}

export default function Row({
  cells,
  columnPath,
  contextMenuPath,
  fresh,
  mode = 'default',
  onContextMenu,
  onExpand,
  onRemove,
}: RowProps) {
  const classes = useStyles()
  const item = cells[0]?.row.original
  const property = mode === 'property' && !!item
  const bad = !!item?.errors.length

  return (
    <M.TableRow>
      {cells.map((cell) => (
        <M.TableCell
          {...cell.getCellProps()}
          key={cell.column.id + cell.row.original.reactId}
          className={cx(classes.cell, {
            [classes.error]: cell.row.original.errors.length,
            [classes.key]: cell.column.id === COLUMN_IDS.KEY,
            [classes.value]: cell.column.id === COLUMN_IDS.VALUE,
            [classes.errorValue]: property && bad && cell.column.id === COLUMN_IDS.VALUE,
          })}
        >
          {cell.render('Cell', {
            columnPath,
            contextMenuPath,
            editing: fresh && cell.column.id === COLUMN_IDS.VALUE,
            onContextMenu,
            onExpand,
            onRemove,
          })}
          {property && cell.column.id === COLUMN_IDS.KEY && item.required && (
            <span aria-label="required" className={classes.required}>
              *
            </span>
          )}
        </M.TableCell>
      ))}
      {property && (
        <>
          <M.TableCell className={cx(classes.cell, classes.meta)}>
            {typeLabel(item.valueSchema)}
          </M.TableCell>
          <M.TableCell className={cx(classes.cell, classes.about)}>
            {/* new-key rows are AddRow, so every row here is a stored key */}
            {item.valueSchema?.description || (item.valueSchema ? '' : 'Not in workflow')}
          </M.TableCell>
        </>
      )}
    </M.TableRow>
  )
}
