import cx from 'classnames'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'
import { styled, withStyles } from '@material-ui/styles'

import JsonDisplay from 'components/JsonDisplay'
import * as RT from 'utils/reactTools'

const Mono = styled('span')(({ theme: t }) => ({
  fontFamily: t.typography.monospace.fontFamily,
}))

const Parquet = RT.composeComponent(
  'Preview.renderers.Parquet',
  RC.setPropTypes({
    className: PT.string,
    preview: PT.string.isRequired,
    createdBy: PT.string,
    formatVersion: PT.string,
    metadata: PT.object,
    numRowGroups: PT.number,
    // { path, logicalType, physicalType, maxDefinitionLevel, maxRepetitionLevel }
    schema: PT.object.isRequired,
    serializedSize: PT.number,
    shape: PT.object, // { rows, columns }
  }),
  withStyles(({ palette, spacing: { unit } }) => ({
    root: {
      width: '100%',
    },
    meta: {},
    metaName: {
      paddingRight: unit,
      textAlign: 'left',
      verticalAlign: 'top',
    },
    dataframe: {
      overflow: 'auto',
      paddingTop: 2 * unit,

      '& table.dataframe': {
        border: 'none',
        width: 'auto',

        '& tr:nth-child(even)': {
          backgroundColor: palette.grey[100],
        },

        '& th, & td': {
          border: 'none',
          fontSize: 'small',
          height: 3 * unit,
          paddingLeft: unit,
          paddingRight: unit,
        },

        '& td': {
          whiteSpace: 'nowrap',
        },
      },
    },
  })),
  ({
    classes,
    className,
    preview,
    createdBy,
    formatVersion,
    metadata,
    numRowGroups,
    schema,
    serializedSize,
    shape,
    ...props
  }) => {
    const renderMeta = (name, value, render = R.identity) =>
      !!value && (
        <tr>
          <th className={classes.metaName}>{name}</th>
          <td>{render(value)}</td>
        </tr>
      )

    return (
      <div className={cx(className, classes.root)} {...props}>
        <table className={classes.meta}>
          <tbody>
            {renderMeta('Created by:', createdBy, (c) => (
              <Mono>{c}</Mono>
            ))}
            {renderMeta('Format version:', formatVersion, (v) => (
              <Mono>{v}</Mono>
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
  },
)

export default (data, props) => <Parquet {...data} {...props} />
