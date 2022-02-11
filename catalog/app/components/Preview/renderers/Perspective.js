import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FileView from 'containers/Bucket/FileView'
import * as Config from 'utils/Config'
import * as perspective from 'utils/perspective'
import { readableBytes } from 'utils/string'

import { CONTEXT } from '../types'

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
    marginRight: t.spacing(0.5),
    verticalAlign: '-6px',
    fontSize: '1.25rem !important', // FIXME: google css re-define styles, wtf
  },
}))

function TruncatedWarning({ className, handle, onLoadMore, size }) {
  const classes = useTruncatedWarningStyles()
  const cfg = Config.use()
  const isLoadableMore = !!onLoadMore
  const isDownloadable = !onLoadMore && !cfg.noDownload
  return (
    <div className={cx(classes.root, className)}>
      <span className={classes.message}>
        <M.Icon fontSize="small" color="inherit" className={classes.icon}>
          info_outlined
        </M.Icon>
        Partial preview{' '}
        {size.current && size.full && (
          <>
            ({readableBytes(size.current)} of {readableBytes(size.full)})
          </>
        )}
      </span>

      {isLoadableMore && (
        <M.Button startIcon={<M.Icon>refresh</M.Icon>} size="small" onClick={onLoadMore}>
          Preview more data
        </M.Button>
      )}

      {isDownloadable && <FileView.DownloadButton handle={handle} />}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  viewer: {
    height: ({ context }) =>
      context === CONTEXT.LISTING ? t.spacing(20) : t.spacing(50),
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
          handle={handle}
          size={size}
          onLoadMore={onLoadMore}
        />
      )}
    </div>
  )
}

export default (data, props) => <Perspective {...data} {...props} />
