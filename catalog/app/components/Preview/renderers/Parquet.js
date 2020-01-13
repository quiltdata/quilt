import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import { renderPreviewStatus } from './util'

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
  dataframe: {
    overflow: 'auto',
    paddingTop: t.spacing(2),

    '& table.dataframe': {
      border: 'none',
      width: 'auto',

      '& tr:nth-child(even)': {
        backgroundColor: t.palette.grey[100],
      },

      '& th, & td': {
        border: 'none',
        fontSize: 'small',
        height: t.spacing(3),
        paddingLeft: t.spacing(1),
        paddingRight: t.spacing(1),
      },

      '& td': {
        whiteSpace: 'nowrap',
      },
    },
  },
}))

function Parquet({
  className,
  preview,
  createdBy,
  formatVersion,
  metadata,
  numRowGroups,
  schema, // { path, logicalType, physicalType, maxDefinitionLevel, maxRepetitionLevel }
  serializedSize,
  shape, // { rows, columns }
  note,
  warnings,
  ...props
}) {
  const classes = useStyles()
  const renderMeta = (name, value, render = R.identity) =>
    !!value && (
      <tr>
        <th className={classes.metaName}>{name}</th>
        <td>{render(value)}</td>
      </tr>
    )

  return (
    <div className={cx(className, classes.root)} {...props}>
      {renderPreviewStatus({ note, warnings })}
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
      <div
        className={classes.dataframe}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: preview }}
      />
    </div>
  )
}

export default (data, props) => <Parquet {...data} {...props} />
