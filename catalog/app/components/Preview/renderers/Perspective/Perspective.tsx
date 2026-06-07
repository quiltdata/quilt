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

// Row count at or below which a preview sizes to its content instead of the
// tall fixed datagrid viewport (avoids a huge empty grid under a tiny file).
const SMALL_ROWS = 20
// Upper bound (px) for the content-sized small preview.
const SMALL_HEIGHT_CAP = 480

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
    overflow: 'hidden',
    // NOTE: padding is required because perspective-viewer covers resize handle
    padding: '0 0 8px',
    resize: 'vertical',
  },
  // Tall fixed viewport for sizeable datasets; small previews (see SMALL_ROWS)
  // skip this and size to their content so a 2-row file doesn't render a huge
  // empty grid.
  tall: {
    minHeight: t.spacing(60),
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
  extends React.HTMLAttributes<HTMLDivElement>,
    PerspectiveOptions {
  data: perspective.PerspectiveInput
  meta?: ParquetMetadata | H5adMetadata | PackageMetadata
  onLoadMore?: () => void
  onRender?: (tableEl: RegularTableElement) => void
  truncated: boolean
}

export default function Perspective({
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

  if (state instanceof Error) {
    return (
      <div className={cx(className, classes.root)} {...props}>
        {!!meta && <Metadata className={classes.meta} metadata={meta} />}
        <Lab.Alert className={classes.warning} severity="info" icon={false}>
          Could not render tabular data
        </Lab.Alert>
      </div>
    )
  }

  // Small, fully-loaded previews get a height sized to their content (the
  // perspective-viewer is a flex child with no intrinsic height, so it
  // collapses to 0 without an explicit one); larger or truncated datasets keep
  // the tall fixed viewport so the datagrid has room to scroll.
  const small = !truncated && state?.size != null && state.size <= SMALL_ROWS
  // header + rows + toolbar/meta chrome, at ~30px/row, capped below the tall floor.
  const smallHeight = small
    ? Math.min((state!.size! + 4) * 30, SMALL_HEIGHT_CAP)
    : undefined

  return (
    <div
      className={cx(
        className,
        classes.root,
        !small && classes.tall,
        !small && classes.fullHeight,
      )}
      ref={setRoot}
      {...props}
      style={
        small ? { height: smallHeight, resize: 'none', ...props.style } : props.style
      }
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
