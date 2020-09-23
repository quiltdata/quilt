import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
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
  return (
    <div className={cx(className, classes.root)} {...props}>
      {renderWarnings(warnings)}
      {!!metadata && <JsonDisplay name="Metadata" value={metadata} />}
      {!!preview && (
        <div
          title={note}
          className={classes.dataframe}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: preview }}
        />
      )}
    </div>
  )
}

export default (data, props) => <Fcs {...data} {...props} />
