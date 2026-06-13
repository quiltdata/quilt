import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import { renderWarnings } from './util'
import Vega from './Vega'

const useStyles = M.makeStyles((t) => ({
  root: {
    maxWidth: '100%',
    minWidth: 0,
  },
  dataframe: {
    display: 'block',
    maxWidth: '100%',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'auto',
    paddingTop: t.spacing(2),

    '& > div': {
      maxWidth: '100%',
    },

    '& table.dataframe': {
      border: 'none',
      minWidth: '100%',
      tableLayout: 'auto',
      width: 'max-content',

      '& tr:nth-child(even)': {
        backgroundColor: t.palette.grey[100],
      },

      '& th, & td': {
        border: 'none',
        fontSize: 'small',
        height: t.spacing(3),
        paddingLeft: t.spacing(1),
        paddingRight: t.spacing(1),
        whiteSpace: 'nowrap',
      },
    },
  },
  chart: {
    marginTop: t.spacing(2),
    maxWidth: '100%',
    minWidth: 0,
  },
}))

function Fcs({ className, preview, metadata, note, vegaLite, warnings, ...props }) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)} {...props}>
      {renderWarnings(warnings)}
      {!!metadata && (
        <JsonDisplay
          defaultExpanded={1}
          name="Metadata"
          style={{
            maxWidth: '100%',
            minWidth: 0,
            overflowWrap: 'anywhere',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
          value={metadata}
        />
      )}
      {!!vegaLite && (
        <div className={classes.chart}>
          <Vega spec={vegaLite} />
        </div>
      )}
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
