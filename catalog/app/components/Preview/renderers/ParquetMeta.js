import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  meta: {},
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  metaName: {
    paddingRight: t.spacing(1),
    textAlign: 'left',
    verticalAlign: 'top',
  },
  metaValue: {
    paddingLeft: t.spacing(1),
  },
}))

function ParquetMeta({
  className,
  createdBy,
  formatVersion,
  metadata,
  numRowGroups,
  schema, // FIXME: { path, logicalType, physicalType, maxDefinitionLevel, maxRepetitionLevel }
  serializedSize,
  shape, // { rows, columns }
  ...props
}) {
  const classes = useStyles()
  const renderMeta = (name, value, render = R.identity) =>
    !!value && (
      <tr>
        <th className={classes.metaName}>{name}</th>
        <td className={classes.metaValue}>{render(value)}</td>
      </tr>
    )

  return (
    <div className={cx(classes.root, className)} {...props}>
      <table className={classes.meta}>
        <tbody>
          {renderMeta('Created by:', createdBy, (c) => (
            <span className={classes.mono}>{c}</span>
          ))}
          {renderMeta('Format version:', formatVersion, (v) => (
            <span className={classes.mono}>{v}</span>
          ))}
          {renderMeta('# row groups:', numRowGroups)}
          {renderMeta('Serialized size:', serializedSize)}
          {renderMeta('Shape:', shape, ({ rows, columns }) => (
            <span>
              {rows} rows &times; {columns} columns
            </span>
          ))}
          {renderMeta('Metadata:', metadata, (m) => (
            <JsonDisplay value={m} />
          ))}
          {renderMeta('Schema:', schema, (s) => (
            <JsonDisplay value={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default (data, props) => <ParquetMeta {...data} {...props} />
