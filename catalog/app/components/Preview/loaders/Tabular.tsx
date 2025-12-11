import * as R from 'ramda'
import * as React from 'react'

import cfg from 'constants/config'
import type * as Model from 'model'
import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'
import mkSearch from 'utils/mkSearch'

import { CONTEXT, PreviewData } from '../types'

import FileType from './fileType'
import * as utils from './utils'

export const FILE_TYPE = FileType.Tabular

const isCsv = utils.extIs('.csv')

const isExcel = utils.extIn(['.xls', '.xlsx'])

const isJsonl = utils.extIs('.jsonl')

const isParquet = R.anyPass([
  utils.extIn(['.parquet', '.pq']),
  R.test(/.+_0$/),
  R.test(/[.-]c\d{3,5}$/gi),
])

const isTsv = utils.extIn(['.tsv', '.tab'])

const isH5ad = utils.extIs('.h5ad')

export const detect = R.pipe(
  utils.stripCompression,
  R.anyPass([isCsv, isExcel, isJsonl, isParquet, isTsv, isH5ad]),
)

type TabularType = 'csv' | 'jsonl' | 'excel' | 'parquet' | 'tsv' | 'h5ad'

const detectTabularType: (type: string) => TabularType = R.pipe(
  utils.stripCompression,
  R.cond([
    [isCsv, R.always('csv')],
    [isExcel, R.always('excel')],
    [isJsonl, R.always('jsonl')],
    [isParquet, R.always('parquet')],
    [isTsv, R.always('tsv')],
    [isH5ad, R.always('h5ad')],
    [R.T, R.always('csv')],
  ]),
)

interface ParquetMetadataBackend {
  created_by: string
  format_version: string
  num_row_groups: number
  schema: {
    names: string[]
  }
  serialized_size: number
  shape: [number, number] // rows, columns
}

export interface ParquetMetadata {
  createdBy: string
  formatVersion: string
  numRowGroups: number
  schema: {
    names: string[]
  }
  shape: { rows: number; columns: number }
}

interface H5adMetadataBackend {
  created_by: string
  format_version: string
  num_row_groups: number
  schema: {
    names: string[]
  }
  serialized_size: number
  shape: [number, number] // rows, columns
  h5ad_obs_keys: string[]
  h5ad_var_keys: string[]
  h5ad_uns_keys: string[]
  h5ad_obsm_keys: string[]
  h5ad_varm_keys: string[]
  h5ad_layers_keys: string[]
  anndata_version?: string
  n_cells: number
  n_genes: number
  matrix_type: string
  has_raw: boolean
}

export interface H5adMetadata {
  createdBy: string
  formatVersion: string
  shape: { rows: number; columns: number }
  schema: {
    names: string[]
  }
  obsKeys: string[]
  varKeys: string[]
  unsKeys: string[]
  obsmKeys: string[]
  varmKeys: string[]
  layersKeys: string[]
  anndataVersion?: string
  nCells: number
  nGenes: number
  matrixType: string
  hasRaw: boolean
}

function getQuiltInfo(
  headers: Headers,
): { meta?: ParquetMetadataBackend | H5adMetadataBackend; truncated: boolean } | null {
  try {
    const header = headers.get('x-quilt-info')
    return header ? JSON.parse(header) : null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

function getContentLength(headers: Headers): number | null {
  try {
    const header = headers.get('content-length')
    return header ? Number(header) : null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

async function getCsvFromResponse(r: Response): Promise<ArrayBuffer | string> {
  const isArrow = r.headers.get('content-type') === 'application/vnd.apache.arrow.file'
  return isArrow ? r.arrayBuffer() : r.text()
}

export const parseParquetData = (data: ParquetMetadataBackend): ParquetMetadata => ({
  createdBy: data.created_by,
  formatVersion: data.format_version,
  numRowGroups: data.num_row_groups,
  schema: data.schema,
  shape: { rows: data.shape[0], columns: data.shape[1] },
})

export const parseH5adData = (data: H5adMetadataBackend): H5adMetadata => ({
  createdBy: data.created_by,
  formatVersion: data.format_version,
  shape: { rows: data.shape[0], columns: data.shape[1] },
  schema: data.schema,
  obsKeys: data.h5ad_obs_keys,
  varKeys: data.h5ad_var_keys,
  unsKeys: data.h5ad_uns_keys,
  obsmKeys: data.h5ad_obsm_keys,
  varmKeys: data.h5ad_varm_keys,
  layersKeys: data.h5ad_layers_keys,
  anndataVersion: data.anndata_version,
  nCells: data.n_cells,
  nGenes: data.n_genes,
  matrixType: data.matrix_type,
  hasRaw: data.has_raw,
})

function isH5adMetadata(
  meta: ParquetMetadataBackend | H5adMetadataBackend,
): meta is H5adMetadataBackend {
  return 'h5ad_obs_keys' in meta
}

interface LoadTabularDataArgs {
  compression?: 'gz' | 'bz2'
  handle: Model.S3.S3ObjectLocation
  sign: (h: Model.S3.S3ObjectLocation) => string
  type: TabularType
  size: 'small' | 'medium' | 'large'
}

interface TabularDataOutput {
  csv: ArrayBuffer | string
  parquetMeta: ParquetMetadata | null
  h5adMeta: H5adMetadata | null
  size: number | null
  truncated: boolean
}

const loadTabularData = async ({
  compression,
  size,
  handle,
  sign,
  type,
}: LoadTabularDataArgs): Promise<TabularDataOutput> => {
  const url = sign(handle)
  const r = await fetch(
    `${cfg.apiGatewayEndpoint}/tabular-preview${mkSearch({
      compression,
      input: type,
      size,
      url,
    })}`,
  )
  try {
    if (r.status >= 400) {
      throw new HTTPError(r)
    }

    const csv = await getCsvFromResponse(r)

    const quiltInfo = getQuiltInfo(r.headers)
    const contentLength = getContentLength(r.headers)

    const parquetMeta =
      quiltInfo?.meta && !isH5adMetadata(quiltInfo.meta)
        ? parseParquetData(quiltInfo.meta)
        : null
    const h5adMeta =
      quiltInfo?.meta && isH5adMetadata(quiltInfo.meta)
        ? parseH5adData(quiltInfo.meta)
        : null

    return {
      csv,
      parquetMeta,
      h5adMeta,
      size: contentLength,
      truncated: !!quiltInfo?.truncated,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Error loading tabular preview', e)
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

function getNeededSize(context: string, gated: boolean) {
  switch (context) {
    case CONTEXT.FILE:
      return gated ? 'medium' : 'large'
    case CONTEXT.LISTING:
      return gated ? 'small' : 'large'
    // no default
  }
}

interface TabularLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
  options: { context: string } // TODO: restrict type
}

export const Loader = function TabularLoader({
  handle,
  children,
  options,
}: TabularLoaderProps) {
  const [gated, setGated] = React.useState(true)
  const sign = AWS.Signer.useS3Signer()
  const type = React.useMemo(() => detectTabularType(handle.key), [handle.key])
  const onLoadMore = React.useCallback(() => setGated(false), [setGated])
  const size = React.useMemo(
    () => getNeededSize(options.context, gated),
    [options.context, gated],
  )

  const compression = utils.getCompression(handle.key)
  const data = Data.use(loadTabularData, {
    compression,
    size,
    handle,
    sign,
    type,
  })
  // TODO: get correct sizes from API
  const processed = utils.useProcessing(
    data.result,
    ({ csv, parquetMeta, h5adMeta, truncated }: TabularDataOutput) =>
      PreviewData.Perspective({
        data: csv,
        handle,
        modes: [FileType.Tabular, FileType.Text],
        parquetMeta,
        h5adMeta,
        onLoadMore: truncated && size !== 'large' ? onLoadMore : null,
        truncated,
      }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
