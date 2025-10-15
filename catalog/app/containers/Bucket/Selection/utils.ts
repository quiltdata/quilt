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

const prefixToHandle = (prefixUrl: string): Model.S3.S3ObjectLocation =>
  s3paths.parseS3Url(prefixUrl)

const handleToPrefix = (handle: Model.S3.S3ObjectLocation): string =>
  s3paths.handleToS3Url(handle)

const joinKeyToHandle = (handle: Model.S3.S3ObjectLocation, suffix: string) => {
  const key = join(s3paths.decode(handle.key), suffix)
  return { bucket: handle.bucket, key }
}

const joinKeyToPrefix = (prefixUrl: string, key: string) => {
  const handle = prefixToHandle(prefixUrl)
  return joinKeyToHandle(handle, key)
}

const toHandle =
  (prefixUrl: string) =>
  ({ logicalKey }: SelectionItem) =>
    joinKeyToPrefix(prefixUrl, logicalKey)

interface SelectionHandles {
  [prefixUrl: string]: Model.S3.S3ObjectLocation[]
}

export const toHandlesMap = (selection: ListingSelection): SelectionHandles =>
  Object.entries(selection).reduce((memo, [prefixUrl, items]) => {
    const selectionToHandle = toHandle(prefixUrl)
    return { ...memo, [prefixUrl]: items.map(selectionToHandle) }
  }, {} as SelectionHandles)

export const toHandlesList = (selection: ListingSelection): Model.S3.S3ObjectLocation[] =>
  Object.entries(selection).reduce((memo, [prefixUrl, items]) => {
    const selectionToHandle = toHandle(prefixUrl)
    return [...memo, ...items.map(selectionToHandle)]
  }, [] as Model.S3.S3ObjectLocation[])

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
  const prefixUrl = handleToPrefix({ bucket, key: path })
  const lens = R.lensProp<Record<string, SelectionItem[]>>(prefixUrl)
  return filter ? R.over(lens, mergeWithFiltered(filter, items)) : R.set(lens, items)
}

const EmptyKeys: string[] = []

export const getDirectorySelection = (
  selection: ListingSelection,
  bucket: string,
  path: string,
) => selection[handleToPrefix({ bucket, key: path })] || EmptyKeys
