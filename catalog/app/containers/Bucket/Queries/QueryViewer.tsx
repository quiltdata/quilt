import Ajv from 'ajv'
import brace from 'brace'
import { JsonEditor as ReactJsonEditor } from 'jsoneditor-react'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import 'brace/mode/json'
import 'brace/theme/eclipse'
import 'jsoneditor-react/es/editor.min.css'

import schema from 'schemas/query.json'
import StyledLink from 'utils/StyledLink'

import * as requests from './requests'

const ES_V = '6.7'
const ES_REF = `https://www.elastic.co/guide/en/elasticsearch/reference/${ES_V}/search.html`

const ajv = new Ajv({ allErrors: true, verbose: true })

const useStyles = M.makeStyles((t) => ({
  editor: {
    padding: t.spacing(1),
    '& .jsoneditor': {
      border: 0,
    },
  },
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
  onError: (error: Error | null) => void
  query: requests.ElasticSearchQuery | string
}

export default function QueryViewer({
  className,
  query,
  onChange,
  onError,
}: QueryViewerProps) {
  const classes = useStyles()

  const t = M.useTheme()

  const [error, setError] = React.useState<Error | null>(null)

  const handleChange = React.useCallback(
    (value: object) => {
      onChange(value as requests.ElasticSearchQuery)
    },
    [onChange],
  )

  const handleError = React.useCallback(
    (e: Error) => {
      setError(e)
      onError(e)
    },
    [onError, setError],
  )

  const handleValidation = React.useCallback(
    (errors: Error[]) => {
      onError(errors && errors.length ? errors[0] : null)
    },
    [onError],
  )

  const editorHtmlProps = React.useMemo(
    () => ({
      style: { height: t.spacing(30) },
    }),
    [t],
  )

  if (!query) return null

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper className={classes.editor}>
        <ReactJsonEditor
          ace={brace}
          ajv={ajv}
          htmlElementProps={editorHtmlProps}
          mainMenuBar={false}
          mode="code"
          navigationBar={false}
          onChange={handleChange}
          onError={handleError}
          onValidationError={handleValidation}
          schema={schema}
          search={false}
          statusBar={false}
          theme="ace/theme/eclipse"
          value={query}
        />
        {error && (
          <Lab.Alert key={error.message} severity="error">
            {error.message}
          </Lab.Alert>
        )}
      </M.Paper>
      <M.FormHelperText>
        Quilt uses ElasticSearch 6.7 Search API.{' '}
        <StyledLink href={ES_REF} target="_blank">
          Learn more
        </StyledLink>
        .
      </M.FormHelperText>
    </div>
  )
}
