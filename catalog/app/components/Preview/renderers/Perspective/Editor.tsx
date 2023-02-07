import Ajv from 'ajv'
import brace from 'brace'
import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'

import type { JsonRecord } from 'utils/types'

const ajv = new Ajv({ allErrors: true, verbose: true })

interface EditorProps {
  className: string
  onChange: (v: JsonRecord) => void
  onError: (e?: Error[]) => void
  schema: JsonRecord
  value: JsonRecord
}
export default function Editor({
  className,
  onChange,
  onError,
  schema,
  value,
}: EditorProps) {
  const editorHtmlProps = React.useMemo(() => ({ className }), [className])
  return (
    <ReactJsonEditor
      ace={brace}
      ajv={ajv}
      htmlElementProps={editorHtmlProps}
      mainMenuBar={false}
      mode="code"
      navigationBar={false}
      onChange={onChange}
      onError={(e) => onError([e])}
      onValidationError={onError}
      schema={schema}
      search={false}
      statusBar={false}
      theme="ace/theme/eclipse"
      value={value}
    />
  )
}
