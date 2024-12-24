export type Mode =
  | '__quiltConfig'
  | '__quiltSummarize'
  | 'less'
  | 'json'
  | 'markdown'
  | 'plain_text'
  | 'yaml'

export interface EditorInputType {
  title?: string
  brace: Mode | null
}
