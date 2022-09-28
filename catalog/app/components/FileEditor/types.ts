export type Mode = 'less' | 'json' | 'markdown' | 'plain_text' | 'yaml'

export interface EditorInputType {
  brace: Mode | null
}
