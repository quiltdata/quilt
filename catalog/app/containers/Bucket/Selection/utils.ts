import { join } from 'path'

import * as R from 'ramda'

import type * as DG from 'components/DataGrid'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export interface PrefixedKeysMap {
  [prefixUrl: string]: DG.GridRowId[]
}

export const EmptyMap: PrefixedKeysMap = {}

interface SelectionHandles {
  [prefixUrl: string]: Model.S3.S3ObjectLocation[]
}

const EMPTY_SELECTION_HANDLES: SelectionHandles = {}

function convertIdToHandle(
  id: string | number,
  parentHandle: Model.S3.S3ObjectLocation,
): Model.S3.S3ObjectLocation {
  const key = join(parentHandle.key, id.toString())
  return {
    bucket: parentHandle.bucket,
    key,
  }
}

export function toHandlesMap(selection: PrefixedKeysMap): SelectionHandles {
  return Object.entries(selection).reduce((memo, [prefixUrl, keys]) => {
    const parentHandle = s3paths.parseS3Url(prefixUrl)
    return {
      ...memo,
      [prefixUrl]: keys.map((id) => convertIdToHandle(id, parentHandle)),
    }
  }, EMPTY_SELECTION_HANDLES)
}

export function toHandlesList(selection: PrefixedKeysMap): Model.S3.S3ObjectLocation[] {
  return Object.entries(selection).reduce((memo, [prefixUrl, keys]) => {
    const parentHandle = s3paths.parseS3Url(prefixUrl)
    return [...memo, ...keys.map((key) => convertIdToHandle(key, parentHandle))]
  }, [] as Model.S3.S3ObjectLocation[])
}

const updateDirectorySelection = (bucket: string, path: string, ids: DG.GridRowId[]) =>
  R.assoc(`s3://${bucket}/${path}`, ids)

const mergeWithPrefixed =
  (prefix: string, prefixedIds: DG.GridRowId[]) => (allIds: DG.GridRowId[]) => {
    if (!allIds || !allIds.length) return prefixedIds
    const selectionOutsidePrefixFilter = allIds.filter(
      (id) => !id.toString().startsWith(prefix),
    )
    const newIds = [...selectionOutsidePrefixFilter, ...prefixedIds]
    return R.equals(newIds, allIds) ? allIds : newIds // avoids cyclic update
  }

const updateWithPrefixSelection = (
  bucket: string,
  path: string,
  prefix: string,
  ids: DG.GridRowId[],
) => {
  const lens = R.lensProp<Record<string, DG.GridRowId[]>>(`s3://${bucket}/${path}`)
  return R.over(lens, mergeWithPrefixed(prefix, ids))
}

export const updateSelection = (
  bucket: string,
  path: string,
  ids: DG.GridRowId[],
  prefix?: string, // FIXME: rename to filter
) =>
  prefix
    ? updateWithPrefixSelection(bucket, path, prefix, ids)
    : updateDirectorySelection(bucket, path, ids)

const EmptyKeys: DG.GridRowId[] = []

export function getDirectorySelection(
  selection: PrefixedKeysMap,
  bucket: string,
  path: string,
) {
  return selection[`s3://${bucket}/${path}`] || EmptyKeys
}
