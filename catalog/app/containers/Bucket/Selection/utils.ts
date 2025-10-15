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

export const toHandlesMap = (selection: ListingSelection): SelectionHandles =>
  Object.entries(selection).reduce(
    (memo, [prefixUrl, items]) => ({
      ...memo,
      [prefixUrl]: items.map((item) =>
        s3paths.parseS3Url(join(prefixUrl, item.logicalKey)),
      ),
    }),
    {} as SelectionHandles,
  )

export const toHandlesList = (selection: ListingSelection): Model.S3.S3ObjectLocation[] =>
  Object.entries(selection).reduce(
    (memo, [prefixUrl, items]) => [
      ...memo,
      ...items.map((item) => s3paths.parseS3Url(join(prefixUrl, item.logicalKey))),
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
  const prefixUrl = s3paths.handleToS3Url({ bucket, key: path })
  const lens = R.lensProp<Record<string, SelectionItem[]>>(prefixUrl)
  return filter ? R.over(lens, mergeWithFiltered(filter, items)) : R.set(lens, items)
}

const EmptyKeys: string[] = []

export const getDirectorySelection = (
  selection: ListingSelection,
  bucket: string,
  path: string,
) => selection[s3paths.handleToS3Url({ bucket, key: path })] || EmptyKeys
