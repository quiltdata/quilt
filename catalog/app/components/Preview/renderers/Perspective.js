import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as perspective from 'utils/perspective'
import { readableBytes } from 'utils/string'

import { CONTEXT } from '../types'

function SizeEstimation({ current, full }) {
  if (!current || !full) return null
  return (
    <span>
      (est. {readableBytes(current)} of {readableBytes(full)})
    </span>
  )
}

const useTruncatedWarningStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  message: {
    color: t.palette.text.secondary,
    marginRight: t.spacing(2),
  },
  icon: {
    display: 'inline-block',
    fontSize: '1.25rem',
    marginRight: t.spacing(0.5),
    verticalAlign: '-5px',
  },
}))

function TruncatedWarning({ className, onLoadMore }) {
  const classes = useTruncatedWarningStyles()
  return (
    <div className={cx(classes.root, className)}>
      <span className={classes.message}>
        <M.Icon fontSize="small" color="inherit" className={classes.icon}>
          info_outlined
        </M.Icon>
        Partial preview <SizeEstimation />
      </span>

      {!!onLoadMore && (
        <M.Button startIcon={<M.Icon>refresh</M.Icon>} size="small" onClick={onLoadMore}>
          Load more
        </M.Button>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  viewer: {
    height: ({ context }) =>
      context === CONTEXT.LISTING ? t.spacing(30) : t.spacing(50),
    overflow: 'auto',
    resize: 'vertical',
  },
  warning: {
    marginBottom: t.spacing(1),
  },
}))

function Perspective({
  children,
  className,
  context,
  data,
  handle,
  onLoadMore,
  size,
  truncated,
  ...props
} = {}) {
  const classes = useStyles({ context })

  const [root, setRoot] = React.useState(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  perspective.use(root, data, attrs)

  return (
    <div className={cx(className, classes.root)} ref={setRoot} {...props}>
      {truncated && (
        <TruncatedWarning
          className={classes.warning}
          size={size}
          onLoadMore={onLoadMore}
        />
      )}
    </div>
  )
}

export default (data, props) => <Perspective {...data} {...props} />
