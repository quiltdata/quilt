import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import AsyncResult from 'utils/AsyncResult'
import * as perspective from 'utils/perspective'
import type { S3HandleBase } from 'utils/s3paths'

import { CONTEXT } from '../types'
import Parquet from './Parquet'

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

interface TruncatedWarningProps {
  className: string
  onLoadMore: () => void
  table: perspective.TableData | null
}

function TruncatedWarning({ className, onLoadMore, table }: TruncatedWarningProps) {
  const classes = useTruncatedWarningStyles()
  return (
    <div className={cx(classes.root, className)}>
      <span className={classes.message}>
        <M.Icon fontSize="small" color="inherit" className={classes.icon}>
          info_outlined
        </M.Icon>
        {table?.size ? `Showing only ${table?.size} rows` : `Partial preview`}
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
  meta: {
    marginBottom: t.spacing(1),
  },
  viewer: {
    height: ({ context }: { context: 'file' | 'listing' }) =>
      context === CONTEXT.LISTING ? t.spacing(30) : t.spacing(50),
    overflow: 'auto',
    resize: 'vertical',
  },
  warning: {
    marginBottom: t.spacing(1),
  },
}))

interface PerspectiveProps extends React.HTMLAttributes<HTMLDivElement> {
  context: 'file' | 'listing'
  data: string | ArrayBuffer
  handle: S3HandleBase
  onLoadMore: () => void
  parquetMeta: $TSFixMe
  truncated: boolean
}

function Perspective({
  children,
  className,
  context,
  data,
  handle,
  onLoadMore,
  parquetMeta,
  truncated,
  ...props
}: PerspectiveProps) {
  const classes = useStyles({ context })

  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  const tableData = perspective.use(root, data, attrs)

  return (
    <div className={cx(className, classes.root)} ref={setRoot} {...props}>
      {truncated && (
        <TruncatedWarning
          className={classes.warning}
          table={tableData}
          onLoadMore={onLoadMore}
        />
      )}
      {AsyncResult.case(
        {
          _: () => null,
          Pending: () => <M.CircularProgress size={24} />,
          Ok: (m: $TSFixMe) => <Parquet className={classes.meta} {...m} />,
          // TODO: Err: re-use Preview/Display handlers
        },
        parquetMeta,
      )}
    </div>
  )
}

export default (data: PerspectiveProps, props: PerspectiveProps) => (
  <Perspective {...data} {...props} />
)
