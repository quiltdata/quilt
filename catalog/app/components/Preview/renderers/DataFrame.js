import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as perspective from 'utils/perspective'

import { renderWarnings } from './util'

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  viewer: {
    height: t.spacing(40),
  },
}))

function DataFrame({ children, className, data, note, warnings, ...props } = {}) {
  const classes = useStyles()

  const [root, setRoot] = React.useState(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  perspective.use(root, data, attrs)

  return (
    <div className={cx(className, classes.root)} ref={setRoot} title={note} {...props}>
      {renderWarnings(warnings)}
    </div>
  )
}

export default ({ data, note, warnings }, props) => (
  <DataFrame {...{ data, note, warnings }} {...props} />
)
