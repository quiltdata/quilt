import { join } from 'path'

import * as R from 'ramda'

import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export interface SelectionItem {
  logicalKey: string
}

export interface ListingSelection {
  [prefixUrl: string]: SelectionItem[]
}

export const EMPTY_MAP: ListingSelection = {}

interface SelectionHandles {
  [prefixUrl: string]: Model.S3.S3ObjectLocation[]
}

const convertIdToHandle = (
  id: string | number,
  parentHandle: Model.S3.S3ObjectLocation,
): Model.S3.S3ObjectLocation => ({
  bucket: parentHandle.bucket,
  key: join(decodeURIComponent(parentHandle.key), id.toString()),
})

export const toHandlesMap = (selection: ListingSelection): SelectionHandles =>
  Object.entries(selection).reduce(
    (memo, [prefixUrl, items]) => ({
      ...memo,
      [prefixUrl]: items.map((item) =>
        convertIdToHandle(item.logicalKey, s3paths.parseS3Url(prefixUrl)),
      ),
    }),
    {} as SelectionHandles,
  )

export const toHandlesList = (selection: ListingSelection): Model.S3.S3ObjectLocation[] =>
  Object.entries(selection).reduce(
    (memo, [prefixUrl, items]) => [
      ...memo,
      ...items.map((item) =>
        convertIdToHandle(item.logicalKey, s3paths.parseS3Url(prefixUrl)),
      ),
    ],
    [] as Model.S3.S3ObjectLocation[],
  )

const mergeWithFiltered =
  (prefix: string, filteredItems: SelectionItem[]) => (allItems: SelectionItem[]) => {
    if (!allItems || !allItems.length) return filteredItems
    const selectionOutsideFilter = allItems.filter(
      (item) => !item.logicalKey.startsWith(prefix),
    )
    const newIds = [...selectionOutsideFilter, ...filteredItems]
    return R.equals(newIds, allItems) ? allItems : newIds // avoids cyclic update
  }

export function merge(
  items: SelectionItem[],
  bucket: string,
  path: string,
  filter?: string,
): (state: ListingSelection) => ListingSelection {
  const prefixUrl = `s3://${bucket}/${encodeURIComponent(path)}`
  const lens = R.lensProp<Record<string, SelectionItem[]>>(prefixUrl)
  return filter ? R.over(lens, mergeWithFiltered(filter, items)) : R.set(lens, items)
}

const EmptyKeys: string[] = []

export const getDirectorySelection = (
  selection: ListingSelection,
  bucket: string,
  path: string,
) => selection[`s3://${bucket}/${path}`] || EmptyKeys
