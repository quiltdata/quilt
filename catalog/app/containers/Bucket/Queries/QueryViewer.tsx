import 'jsoneditor-react/es/editor.min.css'
import '../../../../static/json-editor.css'

import brace from 'brace'
import { JsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
}))

export function parseJSON(str: string) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

export const stringifyJSON = (obj: object | string) => {
  if (typeof obj === 'string') return obj
  return JSON.stringify(obj, null, 2)
}

interface QueryViewerProps {
  className: string
  onChange: (value: requests.ElasticSearchQuery) => void
  query: requests.ElasticSearchQuery | string
}

export default function QueryViewer({ className, query, onChange }: QueryViewerProps) {
  const classes = useStyles()

  const [errors, setErrors] = React.useState<Error[]>([])

  const handleChange = React.useCallback(
    (value: object) => {
      onChange(value as requests.ElasticSearchQuery)
      setErrors([])
    },
    [onChange, setErrors],
  )

  if (!query) return null

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper style={{ padding: '8px' }}>
        <JsonEditor
          ace={brace}
          mainMenuBar={false}
          mode="code"
          navigationBar={false}
          onChange={handleChange}
          onError={setErrors}
          onValidationError={setErrors}
          search={false}
          statusBar={false}
          htmlElementProps={{ style: { height: '300px' } }}
          value={query}
        />
        {errors.map((error: Error) => (
          <Lab.Alert key={error.message} severity="error">
            {error.message}
          </Lab.Alert>
        ))}
      </M.Paper>
    </div>
  )
}
