import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIs('.parquet'),
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
      schema: R.map(
        (i) => ({
          path: i.path,
          logicalType: i.logical_type,
          physicalType: i.physical_type,
          maxDefinitionLevel: i.max_definition_level,
          maxRepetitionLevel: i.max_repetition_level,
        }),
        info.schema,
      ),
      serializedSize: info.serialized_size,
      shape: { rows: info.shape[0], columns: info.shape[1] },
    }),
    PreviewData.Parquet,
    AsyncResult.Ok,
  ),
)
