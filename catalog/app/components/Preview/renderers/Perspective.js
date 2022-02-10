import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as perspective from 'utils/perspective'

import { renderWarnings } from './util'

const useAlertStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
  },
  title: {
    marginLeft: t.spacing(1),
  },
}))

function Alert({ className, title }) {
  const classes = useAlertStyles()
  return (
    <span className={cx(classes.root, className)}>
      <M.Icon fontSize="small" color="inherit">
        info_outlined
      </M.Icon>
      <span className={classes.title}>{title}</span>
    </span>
  )
}

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
  truncated,
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
      {truncated && (
        <div className={classes.truncatedWrapper}>
          {onLoadMore ? (
            <>
              <Alert
                className={classes.truncatedMessage}
                title="Data is partially loaded to reduce bandwidth"
              />
              <M.Button
                startIcon={<M.Icon>refresh</M.Icon>}
                variant="outlined"
                size="small"
                onClick={onLoadMore}
              >
                Load more data
              </M.Button>
            </>
          ) : (
            <Alert
              className={classes.truncatedMessage}
              title="Data is partially loaded, file is too big to load"
            />
          )}
        </div>
      )}
    </div>
  )
}

// FIXME: `note` and `warnings` are unused
export default ({ data, note, warnings, onLoadMore, truncated }, props) => (
  <Perspective {...{ data, note, warnings, onLoadMore, truncated }} {...props} />
)
