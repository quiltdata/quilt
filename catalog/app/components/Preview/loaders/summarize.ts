import type { PerspectiveViewerConfig } from '@finos/perspective-viewer'

export type TypeShorthand =
  | 'echarts'
  | 'json'
  | 'jupyter'
  | 'perspective'
  | 'vega'
  | 'voila'

export type FileShortcut = string

export interface StyleOptions {
  height?: string
}

export interface PerspectiveOptions {
  config?: PerspectiveViewerConfig
}

interface TypeExtendedEssentials {
  name: TypeShorthand
  style?: StyleOptions
}

// Add new specific options like this:
// export type TypeExtended = TypeExtendedEssentials & (PerspectiveOptions | EchartsOptions)
export type TypeExtended = TypeExtendedEssentials & PerspectiveOptions

export type Type = TypeShorthand | TypeExtended

export interface FileExtended {
  path: FileShortcut
  description?: string
  title?: string
  types?: Type[]
}

export type File = FileShortcut | FileExtended

export function detect(fileType: TypeShorthand) {
  return (options: File): Type | undefined =>
    (options as FileExtended)?.types?.find(
      (type) => type === fileType || (type as TypeExtended).name === fileType,
    )
}
