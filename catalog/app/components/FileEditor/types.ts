import type FileType from 'components/Preview/loaders/fileType'

export type Mode = '__quiltConfig' | FileType

export interface EditorInputType {
  title?: string
  type: Mode | null
}
