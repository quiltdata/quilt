import cx from 'classnames'
import * as React from 'react'
import type { RegularTableElement } from 'regular-table'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import * as perspective from 'utils/perspective'

import type {
  ParquetMetadata,
  H5adMetadata,
  PackageMetadata,
} from '../../loaders/Tabular'
import type { PerspectiveOptions } from '../../loaders/summarize'

const useRenderMonoStringStyles = M.makeStyles((t) => ({
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

const RenderMonoString: React.FC<{ value: string }> = ({ value }) => {
  const classes = useRenderMonoStringStyles()
  return <span className={classes.mono}>{value}</span>
}

const RenderNumber: React.FC<{ value: number }> = ({ value }) => <>{value}</>

const RenderShape: React.FC<{ value: [number, number] }> = ({ value }) => (
  <span>
    {value[0]} rows &times; {value[1]} columns
  </span>
)

const RenderBoolean: React.FC<{ value: boolean }> = ({ value }) => (
  <span>{value ? '✓' : '✗'}</span>
)

interface MetadataFieldConfig {
  title: string
  Component: React.ComponentType<{ value: NonNullable<any> }>
}

const FIELDS_MAP: Record<
  Exclude<
    keyof H5adMetadata | keyof ParquetMetadata | keyof PackageMetadata,
    'created_by'
  >,
  MetadataFieldConfig
> = {
  format_version: { title: 'Format version:', Component: RenderMonoString },
  shape: { title: 'Shape:', Component: RenderShape },
  n_cells: { title: 'Cells:', Component: RenderNumber },
  n_genes: { title: 'Genes:', Component: RenderNumber },
  serialized_size: { title: 'Serialized size:', Component: RenderNumber },
  schema: { title: 'Schema:', Component: JsonDisplay },
  matrix_type: { title: 'Matrix type:', Component: RenderMonoString },
  has_raw: { title: 'Has raw data:', Component: RenderBoolean },
  anndata_version: { title: 'AnnData version:', Component: RenderMonoString },
  h5ad_obs_keys: { title: 'Cell metadata keys:', Component: JsonDisplay },
  h5ad_var_keys: { title: 'Gene metadata keys:', Component: JsonDisplay },
  h5ad_uns_keys: { title: 'Unstructured keys:', Component: JsonDisplay },
  h5ad_obsm_keys: { title: 'Cell embeddings:', Component: JsonDisplay },
  h5ad_varm_keys: { title: 'Gene embeddings:', Component: JsonDisplay },
  h5ad_layers_keys: { title: 'Expression layers:', Component: JsonDisplay },
  num_row_groups: { title: '# row groups:', Component: RenderNumber },

  version: { title: 'Manifest version:', Component: RenderMonoString },
  workflow: { title: 'Workflow:', Component: JsonDisplay },
  message: { title: 'Message:', Component: RenderMonoString },
}

const useMetaRowStyles = M.makeStyles((t) => ({
  cell: {
    padding: t.spacing(0.5, 2, 0.5, 1),
  },
}))

interface MetaRowProps {
  title: string
  children?: React.ReactNode
}

const MetaRow: React.FC<MetaRowProps> = ({ title, children }) => {
  const classes = useMetaRowStyles()
  return (
    <M.TableRow>
      <M.TableCell className={classes.cell} component="th" scope="row">
        {title}
      </M.TableCell>
      <M.TableCell className={classes.cell}>{children}</M.TableCell>
    </M.TableRow>
  )
}

const useRenderMetaStyles = M.makeStyles((t) => ({
  table: {
    '& caption': {
      padding: t.spacing(1),
    },
  },
}))

interface RenderMetaProps {
  className: string
  metadata: ParquetMetadata | H5adMetadata | PackageMetadata
}

function RenderMeta({ className, metadata }: RenderMetaProps) {
  const classes = useRenderMetaStyles()

  return (
    <M.Table className={cx(className, classes.table)} size="small">
      {'created_by' in metadata && metadata.created_by && (
        <caption>{metadata.created_by}</caption>
      )}
      <M.TableBody>
        {Object.entries(FIELDS_MAP).map(([key, { title, Component }]) => {
          const value =
            metadata[key as keyof (ParquetMetadata | H5adMetadata | PackageMetadata)]
          return (
            value != null && (
              <MetaRow key={key} title={title}>
                <Component value={value} />
              </MetaRow>
            )
          )
        })}
      </M.TableBody>
    </M.Table>
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
    minHeight: t.spacing(120),
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

  return (
    <div className={cx(className, classes.root)} ref={setRoot} {...props}>
      <Toolbar
        className={classes.toolbar}
        state={state}
        onLoadMore={onLoadMore}
        truncated={truncated}
      />
      {!!meta && <RenderMeta className={classes.meta} metadata={meta} />}
      {children}
    </div>
  )
}
