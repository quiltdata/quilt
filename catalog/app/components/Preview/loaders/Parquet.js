import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  R.anyPass([
    utils.extIn(['.parquet', '.pq']),
    R.test(/.+_0$/),
    R.test(/[.-]c\d{3,5}$/gi),
  ]),
)

export const load = utils.previewFetcher(
  'parquet',
  R.pipe(
    ({ html, info }) => ({
      preview: html,
      createdBy: info.created_by,
      formatVersion: info.format_version,
      metadata: info.metadata,
      numRowGroups: info.num_row_groups,
      schema: info.schema,
      serializedSize: info.serialized_size,
      shape: { rows: info.shape[0], columns: info.shape[1] },
      note: info.note,
      warnings: info.warnings,
    }),
    PreviewData.Parquet,
    AsyncResult.Ok,
  ),
)
