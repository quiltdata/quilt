import { basename } from 'path'

import * as R from 'ramda'

import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail/constants'
import type * as Summarize from 'components/Preview/loaders/summarize'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'

type ImageHandle = LogicalKeyResolver.S3SummarizeHandle & {
  archived?: boolean
  deleted?: boolean
  lastModified?: Date
  size?: number
}

export interface GalleryItem {
  caption: string
  filename: string
  handle: ImageHandle
  path: string
}

export function isGalleryBlock(entry: unknown): entry is Summarize.GalleryBlock {
  return !!(entry as Summarize.GalleryBlock)?.gallery
}

function imagePath(handle: ImageHandle): string {
  return handle.logicalKey || handle.key
}

function isImage(handle: ImageHandle): boolean {
  const path = imagePath(handle).toLowerCase()
  return (
    !handle.archived &&
    !handle.deleted &&
    SUPPORTED_EXTENSIONS.some((ext) => path.endsWith(ext))
  )
}

function normalPrefix(gallery: Summarize.Gallery): string {
  return gallery.source.resolvedPrefix || gallery.source.prefix || ''
}

function inPrefix(path: string, prefix: string): boolean {
  return !prefix || path === prefix || path.startsWith(prefix)
}

function isDirectChild(path: string, prefix: string): boolean {
  const rest = prefix ? path.slice(prefix.length) : path
  return !!rest && !rest.includes('/')
}

function captionFor(
  mode: Summarize.GalleryCaptions | undefined,
  path: string,
  handle: ImageHandle,
): string {
  switch (mode || 'filename') {
    case 'none':
      return ''
    case 'path':
      return path
    case 'title':
      return `${
        (handle as ImageHandle & { title?: string; name?: string }).title ||
        (handle as ImageHandle & { title?: string; name?: string }).name ||
        basename(path)
      }`
    case 'filename':
    default:
      return basename(path)
  }
}

function sortItems(
  items: GalleryItem[],
  sort: Summarize.GallerySort | undefined,
): GalleryItem[] {
  switch (sort || 'path') {
    case 'filename':
      return R.sortBy((item) => item.filename.toLocaleLowerCase(), items)
    case 'modified':
      return [...items].sort(
        (a, b) =>
          (b.handle.lastModified?.getTime() || 0) -
          (a.handle.lastModified?.getTime() || 0),
      )
    case 'path':
    default:
      return R.sortBy((item) => item.path.toLocaleLowerCase(), items)
  }
}

export function resolveGalleryItems(
  gallery: Summarize.Gallery,
  sourceFiles: ImageHandle[] = [],
): GalleryItem[] {
  const prefix = normalPrefix(gallery)
  const recursive = gallery.source.recursive !== false

  return sortItems(
    sourceFiles
      .filter(isImage)
      .filter((handle) => {
        const path = imagePath(handle)
        if (!inPrefix(path, prefix)) return false
        return recursive || isDirectChild(path, prefix)
      })
      .map((handle) => {
        const path = imagePath(handle)
        return {
          caption: captionFor(gallery.captions, path, handle),
          filename: basename(path),
          handle,
          path,
        }
      }),
    gallery.sort,
  )
}
