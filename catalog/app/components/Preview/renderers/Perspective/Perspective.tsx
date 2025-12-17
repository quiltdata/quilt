import cx from 'classnames'
import * as React from 'react'
import type { RegularTableElement } from 'regular-table'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as perspective from 'utils/perspective'

import type { PerspectiveOptions } from '../../loaders/summarize'
import type {
  ParquetMetadata,
  H5adMetadata,
  PackageMetadata,
} from '../../loaders/Tabular'

import Metadata from './Metadata'

const useTruncatedWarningStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
  },
  message: {
    color: t.palette.text.secondary,
  },
  item: {
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  icon: {
    display: 'inline-block',
    fontSize: '1.25rem',
    marginRight: t.spacing(0.5),
    verticalAlign: '-5px',
  },
}))

interface ToolbarProps {
  className: string
  onLoadMore?: () => void
  state: perspective.State | null
  truncated: boolean
}

function Toolbar({ className, onLoadMore, state, truncated }: ToolbarProps) {
  const classes = useTruncatedWarningStyles()
  return (
    <div className={cx(classes.root, className)}>
      {truncated && (
        <span className={cx(classes.message, classes.item)}>
          <M.Icon fontSize="small" color="inherit" className={classes.icon}>
            info_outlined
          </M.Icon>
          {state?.size ? `Showing only ${state?.size} rows` : `Partial preview`}
        </span>
      )}

      {!!onLoadMore && (
        <M.Button
          className={classes.item}
          startIcon={<M.Icon>refresh</M.Icon>}
          size="small"
          onClick={onLoadMore}
        >
          Load more
        </M.Button>
      )}

      {state?.toggleConfig && (
        <M.Button
          className={classes.item}
          startIcon={<M.Icon>tune</M.Icon>}
          size="small"
          onClick={state?.toggleConfig}
        >
          Filter and plot
        </M.Button>
      )}

      {state?.rotateThemes && (
        <M.Button
          className={classes.item}
          startIcon={<M.Icon>palette_outlined</M.Icon>}
          size="small"
          onClick={state?.rotateThemes}
        >
          Toggle theme
        </M.Button>
      )}
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  meta: {
    marginBottom: t.spacing(1),
  },
  viewer: {
    flexGrow: 1,
    zIndex: 1,
  },
  toolbar: {
    marginBottom: t.spacing(1),
  },
  table: {
    flexGrow: 1,
    minHeight: t.spacing(60),

    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',

    // NOTE: padding is required because perspective-viewer covers resize handle
    padding: '0 0 8px',
    resize: 'vertical',
  },
  warning: {
    marginTop: t.spacing(2),
  },
}))

export interface PerspectiveProps
  extends React.HTMLAttributes<HTMLDivElement>,
    PerspectiveOptions {
  data: perspective.PerspectiveInput
  meta?: ParquetMetadata | H5adMetadata | PackageMetadata
  onLoadMore?: () => void
  onRender?: (tableEl: RegularTableElement) => void
  truncated: boolean
}

export default function Perspective({
  className,
  data,
  meta,
  onLoadMore,
  onRender,
  truncated,
  config,
  ...props
}: PerspectiveProps) {
  const classes = useStyles()

  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  const state = perspective.use(root, data, attrs, config, onRender)

  return (
    <div className={className} {...props}>
      {state._tag === 'ready' && (
        <Toolbar
          className={classes.toolbar}
          state={state.state}
          onLoadMore={onLoadMore}
          truncated={truncated}
        />
      )}
      {!!meta && <Metadata className={classes.meta} metadata={meta} />}
      {state._tag === 'error' ? (
        <Lab.Alert className={classes.warning} severity="info" icon={false}>
          Could not render tabular data
        </Lab.Alert>
      ) : (
        <div ref={setRoot} className={classes.table} />
      )}
    </div>
  )
}
