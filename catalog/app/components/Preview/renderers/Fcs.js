import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  meta: {},
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

function Fcs({ className, preview, metadata, note, warnings, ...props }) {
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
      {renderWarnings(warnings)}
      <table className={classes.meta}>
        <tbody>
          {renderMeta('Metadata:', metadata, (m) => (
            <JsonDisplay value={m} />
          ))}
        </tbody>
      </table>
      <div
        title={note}
        className={classes.dataframe}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: preview }}
      />
    </div>
  )
}

export default (data, props) => <Fcs {...data} {...props} />
