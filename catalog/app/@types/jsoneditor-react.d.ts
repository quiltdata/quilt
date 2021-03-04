declare module 'jsoneditor-react' {
  import * as React from 'react'
  import Ajv from 'ajv'

  interface JsonEditorProps {
    ace?: $TSFixMe
    ajv?: Ajv
    theme?: string
    htmlElementProps?: React.HTMLAttributes<{}>
    mainMenuBar?: boolean
    mode?: 'tree' | 'view' | 'form' | 'code' | 'text'
    navigationBar?: boolean
    onChange: (value: $TSFixMe) => void
    onError: (errors: Error) => void
    onValidationError: (errors: Error[]) => void
    schema?: object
    search?: boolean
    statusBar?: boolean
    style?: React.CSSProperties
    value: $TSFixMe
  }

  class JsonEditor extends React.Component<JsonEditorProps> {
    expandAll: () => void
  }
}
