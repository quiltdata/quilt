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
  settings?: boolean
}

export interface TypeExtended extends PerspectiveOptions {
  name: TypeShorthand
  style?: StyleOptions
}

export type Type = TypeShorthand | TypeExtended

export interface FileExtended {
  path: FileShortcut
  description?: string
  title?: string
  types?: Type[]
}

export type File = FileShortcut | FileExtended
