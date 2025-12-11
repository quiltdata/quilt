import cx from 'classnames'
import * as React from 'react'
import type { RegularTableElement } from 'regular-table'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as perspective from 'utils/perspective'
import { JsonRecord } from 'utils/types'

import type { ParquetMetadataBackend, H5adMetadataBackend } from '../../loaders/Tabular'
import type { PerspectiveOptions } from '../../loaders/summarize'

const useParquetMetaStyles = M.makeStyles((t) => ({
  table: {
    margin: t.spacing(1, 0, 1, 3),
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
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

// Reusable render components for metadata values
const RenderMonoString: React.FC<{ value: string }> = ({ value }) => {
  const classes = useParquetMetaStyles()
  return <span className={classes.mono}>{value}</span>
}

const RenderNumber: React.FC<{ value: number }> = ({ value }) => <>{value}</>

const RenderJson: React.FC<{ value: JsonRecord }> = ({ value }) => (
  <JsonDisplay value={value} />
)

const RenderShape: React.FC<{ value: [number, number] }> = ({ value }) => (
  <span>
    {value[0]} rows &times; {value[1]} columns
  </span>
)

const RenderList: React.FC<{ value: string[] }> = ({ value }) => (
  <span>{value.length > 0 ? value.join(', ') : 'None'}</span>
)

const RenderBoolean: React.FC<{ value: boolean }> = ({ value }) => (
  <span>{value ? '✓' : '✗'}</span>
)

// Type guard to distinguish between metadata types
function isH5adMetadata(
  meta: ParquetMetadataBackend | H5adMetadataBackend,
): meta is H5adMetadataBackend {
  return 'h5ad_obs_keys' in meta
}

// Metadata field configuration
interface MetadataFieldConfig {
  title: string
  Component: React.ComponentType<{ value: NonNullable<any> }>
}

const FIELDS_MAP: Record<
  keyof H5adMetadataBackend | keyof ParquetMetadataBackend,
  MetadataFieldConfig
> = {
  created_by: { title: 'Created by:', Component: RenderMonoString },
  format_version: { title: 'Format version:', Component: RenderMonoString },
  num_row_groups: { title: '# row groups:', Component: RenderNumber },
  schema: { title: 'Schema:', Component: RenderJson },
  serialized_size: { title: 'Serialized size:', Component: RenderNumber },
  shape: { title: 'Shape:', Component: RenderShape },
  matrix_type: { title: 'Matrix type:', Component: RenderMonoString },
  n_cells: { title: 'Cells:', Component: RenderNumber },
  n_genes: { title: 'Genes:', Component: RenderNumber },
  has_raw: { title: 'Has raw data:', Component: RenderBoolean },
  anndata_version: { title: 'AnnData version:', Component: RenderMonoString },
  h5ad_obs_keys: { title: 'Cell metadata keys:', Component: RenderList },
  h5ad_var_keys: { title: 'Gene metadata keys:', Component: RenderList },
  h5ad_uns_keys: { title: 'Unstructured keys:', Component: RenderList },
  h5ad_obsm_keys: { title: 'Cell embeddings:', Component: RenderList },
  h5ad_varm_keys: { title: 'Gene embeddings:', Component: RenderList },
  h5ad_layers_keys: { title: 'Expression layers:', Component: RenderList },
}

// Reusable MetaRow component
interface MetaRowProps {
  title: string
  children?: React.ReactNode
}

const MetaRow: React.FC<MetaRowProps> = ({ title, children }) => {
  const classes = useParquetMetaStyles()

  return (
    <tr>
      <th className={classes.metaName}>{title}</th>
      <td className={classes.metaValue}>{children}</td>
    </tr>
  )
}

interface ParquetMetaProps extends ParquetMetadataBackend {
  className: string
}

function ParquetMeta({ className, ...metadata }: ParquetMetaProps) {
  const classes = useParquetMetaStyles()
  const [show, setShow] = React.useState(false)
  const toggleShow = React.useCallback(() => setShow(!show), [show, setShow])

  return (
    <div className={className} {...metadata}>
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
            {Object.entries(FIELDS_MAP).map(([key, { title, Component }]) => {
              const value = metadata[key as keyof ParquetMetadataBackend]
              return (
                value != null && (
                  <MetaRow key={key} title={title}>
                    <Component value={value} />
                  </MetaRow>
                )
              )
            })}
          </tbody>
        </table>
      </M.Collapse>
    </div>
  )
}

interface H5adMetaProps extends H5adMetadataBackend {
  className: string
}

function H5adMeta({ className, ...metadata }: H5adMetaProps) {
  const classes = useParquetMetaStyles()
  const [show, setShow] = React.useState(false)
  const toggleShow = React.useCallback(() => setShow(!show), [show, setShow])

  return (
    <div className={className}>
      <M.Typography className={classes.header} onClick={toggleShow}>
        <M.Icon
          className={cx(classes.headerIcon, { [classes.headerIconExpanded]: show })}
        >
          expand_more
        </M.Icon>
        H5AD metadata
      </M.Typography>
      <M.Collapse in={show}>
        <table className={classes.table}>
          <tbody>
            {Object.entries(FIELDS_MAP).map(([key, { title, Component }]) => {
              const value = metadata[key as keyof H5adMetadataBackend]
              return (
                value != null && (
                  <MetaRow key={key} title={title}>
                    <Component value={value} />
                  </MetaRow>
                )
              )
            })}
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
    minHeight: t.spacing(80),
    overflow: 'hidden',
    // NOTE: padding is required because perspective-viewer covers resize handle
    padding: '0 0 8px',
    resize: 'vertical',
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
  packageMeta?: JsonRecord
  meta?: ParquetMetadataBackend | H5adMetadataBackend
  onLoadMore?: () => void
  onRender?: (tableEl: RegularTableElement) => void
  truncated: boolean
}

export default function Perspective({
  children,
  className,
  data,
  meta,
  packageMeta,
  onLoadMore,
  onRender,
  truncated,
  config,
  ...props
}: PerspectiveProps) {
  // console.log(isH5ad(props.handle.key))
  const classes = useStyles()

  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)

  const attrs = React.useMemo(() => ({ className: classes.viewer }), [classes])
  const state = perspective.use(root, data, attrs, config, onRender)

  return (
    <div className={cx(className, classes.root)} ref={setRoot} {...props}>
      <Toolbar
        className={classes.toolbar}
        state={state}
        onLoadMore={onLoadMore}
        truncated={truncated}
      />
      {!!packageMeta && <JsonDisplay className={classes.meta} value={packageMeta} />}
      {!!meta && !isH5adMetadata(meta) && (
        <ParquetMeta className={classes.meta} {...meta} />
      )}
      {!!meta && isH5adMetadata(meta) && <H5adMeta className={classes.meta} {...meta} />}
      {children}
    </div>
  )
}
