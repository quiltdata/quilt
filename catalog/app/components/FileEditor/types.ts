export type Mode =
  | '__bucketPreferences'
  | '__quiltConfig'
  | '__quiltSummarize'
  | 'json'
  | 'less'
  | 'markdown'
  | 'plain_text'
  | 'yaml'

export interface EditorInputType {
  title?: string
  brace: Mode | null
}
