import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import type {
  ParquetMetadata,
  H5adMetadata,
  PackageMetadata,
} from '../../loaders/Tabular'

const useMonoStringStyles = M.makeStyles((t) => ({
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

const MonoString: React.FC<{ value: string }> = ({ value }) => {
  const classes = useMonoStringStyles()
  return <span className={classes.mono}>{value}</span>
}

const Shape: React.FC<{ value: [number, number] }> = ({ value }) => (
  <span>
    {value[0]} rows &times; {value[1]} columns
  </span>
)

const Boolean: React.FC<{ value: boolean }> = ({ value }) => (
  <span>{value ? '✓' : '✗'}</span>
)

interface MetadataFieldConfig {
  title: string
  RenderValue?: React.ComponentType<{ value: NonNullable<any> }>
}

const FIELDS_MAP: Record<
  Exclude<
    keyof H5adMetadata | keyof ParquetMetadata | keyof PackageMetadata,
    'created_by'
  >,
  MetadataFieldConfig
> = {
  format_version: { title: 'Format version:', RenderValue: MonoString },
  shape: { title: 'Shape:', RenderValue: Shape },
  n_cells: { title: 'Cells:' },
  n_genes: { title: 'Genes:' },
  serialized_size: { title: 'Serialized size:' },
  schema: { title: 'Schema:', RenderValue: JsonDisplay },
  matrix_type: { title: 'Matrix type:', RenderValue: MonoString },
  has_raw: { title: 'Has raw data:', RenderValue: Boolean },
  anndata_version: { title: 'AnnData version:', RenderValue: MonoString },
  h5ad_obs_keys: { title: 'Cell metadata keys:', RenderValue: JsonDisplay },
  h5ad_var_keys: { title: 'Gene metadata keys:', RenderValue: JsonDisplay },
  h5ad_uns_keys: { title: 'Unstructured keys:', RenderValue: JsonDisplay },
  h5ad_obsm_keys: { title: 'Cell embeddings:', RenderValue: JsonDisplay },
  h5ad_varm_keys: { title: 'Gene embeddings:', RenderValue: JsonDisplay },
  h5ad_layers_keys: { title: 'Expression layers:', RenderValue: JsonDisplay },
  num_row_groups: { title: '# row groups:' },

  version: { title: 'Manifest version:', RenderValue: MonoString },
  workflow: { title: 'Workflow:', RenderValue: JsonDisplay },
  message: { title: 'Message:' },
}

const useStyles = M.makeStyles((t) => ({
  root: {
    '& caption': {
      padding: t.spacing(1),
    },
  },
  cell: {
    padding: t.spacing(0.5, 2, 0.5, 1),
  },
}))

interface RenderMetaProps {
  className: string
  metadata: ParquetMetadata | H5adMetadata | PackageMetadata
}

export default function Metadata({ className, metadata }: RenderMetaProps) {
  const classes = useStyles()

  return (
    <M.Table className={cx(className, classes.root)} size="small">
      {'created_by' in metadata && metadata.created_by && (
        <caption>{metadata.created_by}</caption>
      )}
      <M.TableBody>
        {Object.entries(FIELDS_MAP).map(([key, { title, RenderValue }]) => {
          const value =
            metadata[key as keyof (ParquetMetadata | H5adMetadata | PackageMetadata)]
          return (
            value != null && (
              <M.TableRow key={key}>
                <M.TableCell className={classes.cell} component="th" scope="row">
                  {title}
                </M.TableCell>
                <M.TableCell className={classes.cell}>
                  {RenderValue ? <RenderValue value={value} /> : value}
                </M.TableCell>
              </M.TableRow>
            )
          )
        })}
      </M.TableBody>
    </M.Table>
  )
}
