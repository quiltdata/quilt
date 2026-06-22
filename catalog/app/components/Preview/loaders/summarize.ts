import type { ViewConfig } from '@finos/perspective'

import FileType from './fileType'

// TODO: enable all available file types?
export type TypeShorthand =
  | typeof FileType.ECharts
  | typeof FileType.Igv
  | typeof FileType.Json
  | typeof FileType.Jupyter
  | typeof FileType.Tabular
  | typeof FileType.Vega
  | typeof FileType.Voila
  | typeof FileType.Text
  | typeof FileType.Html

export type FileShortcut = string

export interface StyleOptions {
  height?: string
}

export interface PerspectiveOptions {
  config?: ViewConfig
  settings?: boolean
}

interface TypeExtendedEssentials {
  name: TypeShorthand
  style?: StyleOptions
}

// Add new specific options like this:
// export type TypeExtended = TypeExtendedEssentials & (PerspectiveOptions | EChartsOptions)
export type TypeExtended = TypeExtendedEssentials & PerspectiveOptions

export type Type = TypeShorthand | TypeExtended

export interface FileExtended {
  path: FileShortcut
  description?: string
  title?: string
  types?: Type[]

  expand?: boolean
  width?: string | number
}

export type File = FileShortcut | FileExtended

export type GallerySourceScope = 'package' | 'folder'
export type GalleryArrows = 'inside' | 'outside' | 'overlay' | 'none'
export type GalleryCaptions = 'filename' | 'path' | 'none'
export type GalleryThumbnailFit = 'contain' | 'cover'
export type GallerySort = 'path' | 'filename'

export interface GallerySource {
  scope?: GallerySourceScope
  prefix?: string
  recursive?: boolean
  resolvedPrefix?: string
}

export interface Gallery {
  source: GallerySource
  columns?: number
  rows?: number
  pageSize?: number
  arrows?: GalleryArrows
  captions?: GalleryCaptions
  counter?: boolean
  thumbnailFit?: GalleryThumbnailFit
  sort?: GallerySort
  zoom?: boolean
  fullscreen?: boolean
}

export interface GalleryBlock {
  gallery: Gallery
  description?: string
  title?: string
  width?: string | number
}

export type Row = File | File[] | GalleryBlock

export function detect(fileType: TypeShorthand, options: File): Type | undefined {
  return (options as FileExtended)?.types?.find(
    (type) => type === fileType || (type as TypeExtended).name === fileType,
  )
}
