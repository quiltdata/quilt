import { join } from 'path'

import * as R from 'ramda'

import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export interface PrefixedKeysMap {
  [prefixUrl: string]: string[]
}

export const EMPTY_MAP: PrefixedKeysMap = {}

interface SelectionHandles {
  [prefixUrl: string]: Model.S3.S3ObjectLocation[]
}

const convertIdToHandle = (
  id: string | number,
  parentHandle: Model.S3.S3ObjectLocation,
): Model.S3.S3ObjectLocation => ({
  bucket: parentHandle.bucket,
  key: join(parentHandle.key, id.toString()),
})

export const toHandlesMap = (selection: PrefixedKeysMap): SelectionHandles =>
  Object.entries(selection).reduce(
    (memo, [prefixUrl, keys]) => ({
      ...memo,
      [prefixUrl]: keys.map((id) => convertIdToHandle(id, s3paths.parseS3Url(prefixUrl))),
    }),
    {} as SelectionHandles,
  )

export const toHandlesList = (selection: PrefixedKeysMap): Model.S3.S3ObjectLocation[] =>
  Object.entries(selection).reduce(
    (memo, [prefixUrl, keys]) => [
      ...memo,
      ...keys.map((key) => convertIdToHandle(key, s3paths.parseS3Url(prefixUrl))),
    ],
    [] as Model.S3.S3ObjectLocation[],
  )

const mergeWithFiltered =
  (prefix: string, filteredIds: string[]) => (allIds: string[]) => {
    if (!allIds || !allIds.length) return filteredIds
    const selectionOutsideFilter = allIds.filter((id) => !id.startsWith(prefix))
    const newIds = [...selectionOutsideFilter, ...filteredIds]
    return R.equals(newIds, allIds) ? allIds : newIds // avoids cyclic update
  }

export function merge(
  ids: string[],
  location: Model.S3.S3ObjectLocation,
  filter?: string,
) {
  const prefixUrl = s3paths.handleToS3Url(location)
  const lens = R.lensProp<Record<string, string[]>>(prefixUrl)
  return filter ? R.over(lens, mergeWithFiltered(filter, ids)) : R.set(lens, ids)
}

const EmptyKeys: string[] = []

export const getDirectorySelection = (
  selection: PrefixedKeysMap,
  { bucket, key }: Model.S3.S3ObjectLocation,
) => selection[`s3://${bucket}/${key}`] || EmptyKeys
