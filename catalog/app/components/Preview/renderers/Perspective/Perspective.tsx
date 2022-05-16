import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as perspective from 'utils/perspective'

import { ParquetMetadata } from '../../loaders/Tabular'
import type { PerspectiveOptions } from '../../loaders/summarize'

const useParquetMetaStyles = M.makeStyles((t) => ({
  table: {
    margin: t.spacing(1, 0, 1, 3),
  },
  mono: {
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
  },
  metaName: {
    paddingRight: t.spacing(1),
    textAlign: 'left',
    verticalAlign: 'top',
  },
  metaValue: {
    paddingLeft: t.spacing(1),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  headerIcon: {
    fontSize: '1.1rem',
    transform: 'rotate(-90deg)',
    marginRight: t.spacing(0.5),
    transition: 'transform 0.3s ease',
  },
  headerIconExpanded: {
    transform: 'rotate(0deg)',
  },
}))

interface ParquetMetaProps extends ParquetMetadata {
  className: string
}

function ParquetMeta({
  className,
  createdBy,
  formatVersion,
  numRowGroups,
  schema, // { names }
  serializedSize,
  shape, // { rows, columns }
  ...props
}: ParquetMetaProps) {
  const classes = useParquetMetaStyles()
  const [show, setShow] = React.useState(false)
  const toggleShow = React.useCallback(() => setShow(!show), [show, setShow])
  const renderMeta = (
    name: string,
    value: ParquetMetadata[keyof ParquetMetadata],
    render: (v: $TSFixMe) => JSX.Element = R.identity,
  ) =>
    !!value && (
      <tr>
        <th className={classes.metaName}>{name}</th>
        <td className={classes.metaValue}>{render(value)}</td>
      </tr>
    )

  return (
    <div className={className} {...props}>
      <M.Typography className={classes.header} onClick={toggleShow}>
        <M.Icon
          className={cx(classes.headerIcon, { [classes.headerIconExpanded]: show })}
        >
          expand_more
        </M.Icon>
        Parquet metadata
      </M.Typography>
      <M.Collapse in={show}>
        <table className={classes.table}>
          <tbody>
            {renderMeta('Created by:', createdBy, (c: string) => (
              <span className={classes.mono}>{c}</span>
            ))}
            {renderMeta('Format version:', formatVersion, (v: string) => (
              <span className={classes.mono}>{v}</span>
            ))}
            {renderMeta('# row groups:', numRowGroups)}
            {renderMeta('Serialized size:', serializedSize)}
            {renderMeta('Shape:', shape, ({ rows, columns }) => (
              <span>
                {rows} rows &times; {columns} columns
              </span>
            ))}
            {renderMeta('Schema:', schema, (s: { names: string[] }) => (
              /* @ts-expect-error */
              <JsonDisplay value={s} />
            ))}
          </tbody>
        </table>
      </M.Collapse>
    </div>
  )
}

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
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: t.spacing(80),
    overflow: 'hidden',
    // NOTE: padding is required because perspective-viewer covers resize handle
    padding: '0 0 8px',
    resize: 'vertical',
    width: '100%',
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
}))

export interface PerspectiveProps
  extends React.HTMLAttributes<HTMLDivElement>,
    PerspectiveOptions {
  data: perspective.PerspectiveInput
  meta?: ParquetMetadata
  onLoadMore?: () => void
  truncated: boolean
}

export default function Perspective({
  children,
  className,
  data,
  meta,
  onLoadMore,
  truncated,
  config,
  ...props
}: PerspectiveProps) {
  const classes = useStyles()

  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  const state = perspective.use(root, data, attrs, config)

  return (
    <div className={cx(className, classes.root)} ref={setRoot} {...props}>
      <Toolbar
        className={classes.toolbar}
        state={state}
        onLoadMore={onLoadMore}
        truncated={truncated}
      />
      {!!meta && <ParquetMeta className={classes.meta} {...meta} />}
      {children}
    </div>
  )
}
