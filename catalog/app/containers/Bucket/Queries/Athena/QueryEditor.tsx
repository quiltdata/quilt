import * as React from 'react'
import AceEditor from 'react-ace'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as requests from '../requests'

const ATHENA_REF = 'https://aws.amazon.com/athena/'

const useStyles = M.makeStyles((t) => ({
  editor: {
    padding: t.spacing(1),
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
}))

interface QueryEditorProps {
  className?: string
  onChange: (value: string) => void
  query: string
}

function QueryEditor({ className, query, onChange }: QueryEditorProps) {
  const classes = useStyles()

  return (
    <div className={className}>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper className={classes.editor}>
        <AceEditor
          editorProps={{ $blockScrolling: true }}
          height="200px"
          mode="sql"
          onChange={onChange}
          theme="eclipse"
          value={query}
          width="100%"
        />
      </M.Paper>
      <M.FormHelperText>
        Quilt uses AWS Athena SQL.{' '}
        <StyledLink href={ATHENA_REF} target="_blank">
          Learn more
        </StyledLink>
        .
      </M.FormHelperText>
    </div>
  )
}

function useQueryRun(
  bucket: string,
  workgroup: requests.athena.Workgroup,
  queryExecutionId?: string,
) {
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<Error | undefined>()
  const runQuery = requests.athena.useQueryRun(workgroup)
  const { push: notify } = Notifications.use()
  const goToExecution = React.useCallback(
    (id: string) => history.push(urls.bucketAthenaExecution(bucket, workgroup, id)),
    [bucket, history, urls, workgroup],
  )
  const onSubmit = React.useCallback(
    async (value: string) => {
      setLoading(true)
      setError(undefined)
      try {
        const { id } = await runQuery(value)
        if (id === queryExecutionId) notify('Query execution results remain unchanged')
        setLoading(false)
        goToExecution(id)
      } catch (e) {
        if (e instanceof Error) {
          setError(e)
        }
        setLoading(false)
      }
    },
    [goToExecution, notify, runQuery, queryExecutionId],
  )
  return React.useMemo(
    () => ({
      loading,
      error,
      onSubmit,
    }),
    [loading, error, onSubmit],
  )
}

const useQueryBodyFieldStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  error: {
    margin: t.spacing(1, 0, 0),
  },
}))

interface QueryBodyProps {
  bucket: string
  className?: string
  initialValue: string | null
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

export default function Form({
  bucket,
  className,
  initialValue,
  workgroup,
  queryExecutionId,
}: QueryBodyProps) {
  const classes = useQueryBodyFieldStyles()
  const [value, setValue] = React.useState<string | null>(initialValue)

  const { loading, error, onSubmit } = useQueryRun(bucket, workgroup, queryExecutionId)
  const handleSubmit = React.useCallback(() => {
    if (!value) return
    onSubmit(value)
  }, [onSubmit, value])

  return (
    <div className={className}>
      <QueryEditor onChange={setValue} query={value || ''} />

      {error && (
        <Lab.Alert className={classes.error} severity="error">
          {error.message}
        </Lab.Alert>
      )}

      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          disabled={!value || loading}
          onClick={handleSubmit}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}
