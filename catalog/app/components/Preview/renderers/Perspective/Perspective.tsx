import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as perspective from 'utils/perspective'
import type { S3HandleBase } from 'utils/s3paths'

import { ParquetMetadata } from '../../loaders/Tabular'
import { CONTEXT } from '../../types'

const useParquetMetaStyles = M.makeStyles((t) => ({
  root: {
    width: '100%',
  },
  meta: {},
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
    <div className={cx(classes.root, className)} {...props}>
      <table className={classes.meta}>
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
    zIndex: 1,
  },
  warning: {
    marginBottom: t.spacing(1),
  },
}))

export interface PerspectiveProps extends React.HTMLAttributes<HTMLDivElement> {
  context: 'file' | 'listing'
  data: string | ArrayBuffer
  meta: ParquetMetadata
  handle: S3HandleBase
  onLoadMore: () => void
  truncated: boolean
}

export default function Perspective({
  children,
  className,
  context,
  data,
  meta,
  handle,
  onLoadMore,
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
      {!!meta && <ParquetMeta className={classes.meta} {...meta} />}
      {children}
    </div>
  )
}
