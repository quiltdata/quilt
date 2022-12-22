import type { PerspectiveViewerConfig } from '@finos/perspective-viewer'

import * as modes from 'components/Preview/loaders/modes'

export type TypeShorthand =
  | typeof modes.Echarts
  | typeof modes.Igv
  | typeof modes.Json
  | typeof modes.Jupyter
  | typeof modes.Tabular
  | typeof modes.Vega
  | typeof modes.Voila

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
