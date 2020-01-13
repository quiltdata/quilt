import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { renderPreviewStatus } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  wrapper: {
    overflow: 'auto',

    '& table.dataframe': {
      border: 'none',
      minWidth: '100%',
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

function DataFrame({ children, className, note, warnings, ...props } = {}) {
  const classes = useStyles()
  return (
    <div className={cx(className, classes.root)} {...props}>
      {renderPreviewStatus({ note, warnings })}
      <div
        className={classes.wrapper}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: children }}
      />
    </div>
  )
}

export default ({ preview, note, warnings }, props) => (
  <DataFrame {...{ note, warnings }} {...props}>
    {preview}
  </DataFrame>
)
