import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as FileView from 'containers/Bucket/FileView'
import * as Config from 'utils/Config'
import * as perspective from 'utils/perspective'

import { renderWarnings } from './util'

const useAlertStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.secondary,
  },
  icon: {
    display: 'inline-block',
    marginRight: t.spacing(0.5),
    verticalAlign: '-6px',
    fontSize: '1.25rem !important', // FIXME: google css re-define styles, wtf
  },
}))

function Alert({ className, title }) {
  const classes = useAlertStyles()
  return (
    <span className={cx(classes.root, className)}>
      <M.Icon fontSize="small" color="inherit" className={classes.icon}>
        info_outlined
      </M.Icon>
      {title}
    </span>
  )
}

const useTruncatedWarningStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  message: {
    marginRight: t.spacing(2),
  },
}))

function TruncatedWarning({ className, handle, onLoadMore }) {
  const classes = useTruncatedWarningStyles()
  const cfg = Config.use()
  return (
    <div className={cx(classes.root, className)}>
      {onLoadMore ? (
        <>
          <Alert className={classes.message} title="Partial preview" />
          <M.Button
            startIcon={<M.Icon>refresh</M.Icon>}
            variant="outlined"
            size="small"
            onClick={onLoadMore}
          >
            Preview more data
          </M.Button>
        </>
      ) : (
        <>
          <Alert
            className={classes.message}
            title="Data is partially loaded, file is too big to load"
          />
          {!cfg.noDownload && <FileView.DownloadButton handle={handle} />}
        </>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  viewer: {
    height: t.spacing(40),
  },
  warning: {
    marginBottom: t.spacing(1),
  },
}))

function Perspective({
  children,
  className,
  data,
  handle,
  note,
  onLoadMore,
  truncated,
  warnings,
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
        <TruncatedWarning
          className={classes.warning}
          handle={handle}
          onLoadMore={onLoadMore}
        />
      )}
    </div>
  )
}

// FIXME: `note` and `warnings` are unused
export default ({ data, handle, note, warnings, onLoadMore, truncated }, props) => (
  <Perspective {...{ data, handle, note, warnings, onLoadMore, truncated }} {...props} />
)
