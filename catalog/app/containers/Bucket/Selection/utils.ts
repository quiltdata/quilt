import { join } from 'path'

import type * as DG from 'components/DataGrid'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export interface PrefixedKeysMap {
  [prefixUrl: string]: DG.GridRowId[]
}

interface SelectionHandles {
  [prefixUrl: string]: Model.S3.S3ObjectLocation[]
}

const EMPTY_SELECTION_HANDLES: SelectionHandles = {}

export function convertIdsToHandles(selection: PrefixedKeysMap): SelectionHandles {
  return Object.entries(selection).reduce((memo, [prefixUrl, keys]) => {
    const parentHandle = s3paths.parseS3Url(prefixUrl)
    return {
      ...memo,
      [prefixUrl]: keys.map((id) => {
        const key = join(parentHandle.key, id.toString())
        return {
          bucket: parentHandle.bucket,
          key,
        }
      }),
    }
  }, EMPTY_SELECTION_HANDLES)
}
