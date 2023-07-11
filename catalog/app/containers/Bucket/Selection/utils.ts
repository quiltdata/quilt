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
  }, {} as SelectionHandles)
}

export function toHandlesList(selection: PrefixedKeysMap): Model.S3.S3ObjectLocation[] {
  return Object.entries(selection).reduce((memo, [prefixUrl, keys]) => {
    const parentHandle = s3paths.parseS3Url(prefixUrl)
    return [...memo, ...keys.map((key) => convertIdToHandle(key, parentHandle))]
  }, [] as Model.S3.S3ObjectLocation[])
}

const mergeWithFiltered =
  (prefix: string, filteredIds: string[]) => (allIds: string[]) => {
    if (!allIds || !allIds.length) return filteredIds
    const selectionOutsideFilter = allIds.filter(
      (id) => !id.toString().startsWith(prefix),
    )
    const newIds = [...selectionOutsideFilter, ...filteredIds]
    return R.equals(newIds, allIds) ? allIds : newIds // avoids cyclic update
  }

export function merge(ids: string[], bucket: string, path: string, filter?: string) {
  const lens = R.lensProp<Record<string, string[]>>(`s3://${bucket}/${path}`)
  return filter ? R.over(lens, mergeWithFiltered(filter, ids)) : R.set(lens, ids)
}

const EmptyKeys: string[] = []

export function getDirectorySelection(
  selection: PrefixedKeysMap,
  bucket: string,
  path: string,
) {
  return selection[`s3://${bucket}/${path}`] || EmptyKeys
}
