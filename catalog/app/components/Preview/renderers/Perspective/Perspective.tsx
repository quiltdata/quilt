import cx from 'classnames'
import * as React from 'react'
import type { RegularTableElement } from 'regular-table'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import { ErrorBoundary } from 'react-error-boundary'

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
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: t.spacing(60),
    overflow: 'hidden',
    // NOTE: padding is required because perspective-viewer covers resize handle
    padding: '0 0 8px',
    resize: 'vertical',
  },
  fullHeight: {
    minHeight: t.spacing(120),
  },
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
  warning: {
    marginTop: t.spacing(2),
  },
}))

export interface PerspectiveProps
  extends React.HTMLAttributes<HTMLDivElement>, PerspectiveOptions {
  data: perspective.PerspectiveInput
  meta?: ParquetMetadata | H5adMetadata | PackageMetadata
  onLoadMore?: () => void
  onRender?: (tableEl: RegularTableElement) => void
  truncated: boolean
}

function PerspectiveTable({
  children,
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
    <div
      className={cx(className, classes.root, classes.fullHeight)}
      ref={setRoot}
      {...props}
    >
      <Toolbar
        className={classes.toolbar}
        state={state}
        onLoadMore={onLoadMore}
        truncated={truncated}
      />
      {!!meta && <Metadata className={classes.meta} metadata={meta} />}
      {children}
    </div>
  )
}

interface ErrorFallbackProps {
  className?: string
  meta?: ParquetMetadata | H5adMetadata | PackageMetadata
}

// NOTE: `react-error-boundary` does not catch what its own fallback throws, so
//       an error originating in `Metadata` escapes this boundary.
function ErrorFallback({ className, meta }: ErrorFallbackProps) {
  const classes = useStyles()
  return (
    <div className={cx(className, classes.root)}>
      {!!meta && <Metadata className={classes.meta} metadata={meta} />}
      <Lab.Alert className={classes.warning} severity="info" icon={false}>
        Could not render tabular data
      </Lab.Alert>
    </div>
  )
}

export default function Perspective({ className, meta, ...props }: PerspectiveProps) {
  return (
    <ErrorBoundary
      resetKeys={[props.data]}
      fallbackRender={() => <ErrorFallback className={className} meta={meta} />}
    >
      <PerspectiveTable className={className} meta={meta} {...props} />
    </ErrorBoundary>
  )
}
