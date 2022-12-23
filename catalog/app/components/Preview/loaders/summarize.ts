import type { PerspectiveViewerConfig } from '@finos/perspective-viewer'

import Modes from 'components/Preview/loaders/modes'

// FIXME: Modes?
export type TypeShorthand =
  | typeof Modes.Echarts
  | typeof Modes.Igv
  | typeof Modes.Json
  | typeof Modes.Jupyter
  | typeof Modes.Tabular
  | typeof Modes.Vega
  | typeof Modes.Voila

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

export function detect(fileType: TypeShorthand, options: File): Type | undefined {
  return (options as FileExtended)?.types?.find(
    (type) => type === fileType || (type as TypeExtended).name === fileType,
  )
}
