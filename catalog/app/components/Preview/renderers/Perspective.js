import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as perspective from 'utils/perspective'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  truncatedMessage: {
    marginRight: t.spacing(2),
  },
  truncatedWrapper: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  viewer: {
    height: t.spacing(40),
  },
}))

function Perspective({
  children,
  className,
  data,
  note,
  warnings,
  onLoadMore,
  ...props
} = {}) {
  const classes = useStyles()

  const [root, setRoot] = React.useState(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  perspective.use(root, data, attrs)

  return (
    <div className={cx(className, classes.root)} ref={setRoot} title={note} {...props}>
      {renderWarnings(warnings)}
      {onLoadMore && (
        <div className={classes.truncatedWrapper}>
          <M.Typography variant="caption" className={classes.truncatedMessage}>
            Data is partially loaded to reduce bandwidth
          </M.Typography>
          <div>
            <M.Button variant="outlined" size="small" onClick={onLoadMore}>
              Load full data
            </M.Button>
          </div>
        </div>
      )}
    </div>
  )
}

// FIXME: `note` and `warnings` are unused
export default ({ data, note, warnings, onLoadMore }, props) => (
  <Perspective {...{ data, note, warnings, onLoadMore }} {...props} />
)
