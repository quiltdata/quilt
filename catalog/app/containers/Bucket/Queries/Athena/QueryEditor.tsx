import * as React from 'react'
import AceEditor from 'react-ace'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as requests from '../requests'

import Database from './Database'

const ATHENA_REF = 'https://aws.amazon.com/athena/'

const useStyles = M.makeStyles((t) => ({
  editor: {
    padding: t.spacing(1),
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
}))

interface EditorFieldProps {
  className?: string
  onChange: (value: string) => void
  query: string
}

function EditorField({ className, query, onChange }: EditorFieldProps) {
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
    async (value: string, executionContext?: requests.athena.ExecutionContext) => {
      setLoading(true)
      setError(undefined)
      try {
        const { id } = await runQuery(value, executionContext)
        if (id === queryExecutionId) notify('Query execution results remain unchanged')
        setLoading(false)
        goToExecution(id)
      } catch (e) {
        setLoading(false)
        if (e instanceof Error) {
          setError(e)
        } else {
          throw e
        }
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

const useFormSkeletonStyles = M.makeStyles((t) => ({
  button: {
    height: t.spacing(4),
    marginTop: t.spacing(2),
    width: t.spacing(14),
  },
  canvas: {
    flexGrow: 1,
    height: t.spacing(27),
    marginLeft: t.spacing(1),
  },
  editor: {
    display: 'flex',
    marginTop: t.spacing(1),
  },
  helper: {
    height: t.spacing(2),
    marginTop: t.spacing(1),
  },
  numbers: {
    height: t.spacing(27),
    width: t.spacing(5),
  },
  title: {
    height: t.spacing(3),
    width: t.spacing(16),
  },
}))

interface FormSkeletonProps {
  className: string
}

function FormSkeleton({ className }: FormSkeletonProps) {
  const classes = useFormSkeletonStyles()
  return (
    <div className={className}>
      <Skeleton className={classes.title} animate />
      <div className={classes.editor}>
        <Skeleton className={classes.numbers} animate />
        <Skeleton className={classes.canvas} animate />
      </div>
      <Skeleton className={classes.helper} animate />
      <Skeleton className={classes.button} animate />
    </div>
  )
}

export { FormSkeleton as Skeleton }

const useFormStyles = M.makeStyles((t) => ({
  actions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    display: 'flex',
    margin: t.spacing(2, 0),
  },
  error: {
    margin: t.spacing(1, 0, 0),
  },
}))

interface FormProps {
  bucket: string
  className?: string
  initialValue: string | null
  queryExecutionId?: string
  workgroup: requests.athena.Workgroup
}

export function Form({
  bucket,
  className,
  initialValue,
  workgroup,
  queryExecutionId,
}: FormProps) {
  const classes = useFormStyles()
  const [value, setValue] = React.useState<string | null>(initialValue)
  const [executionContext, setExecutionContext] =
    React.useState<requests.athena.ExecutionContext | null>(null)

  const { loading, error, onSubmit } = useQueryRun(bucket, workgroup, queryExecutionId)
  const handleSubmit = React.useCallback(() => {
    if (!value) return
    onSubmit(value, executionContext || undefined)
  }, [executionContext, onSubmit, value])

  return (
    <div className={className}>
      <EditorField onChange={setValue} query={value || ''} />

      {error && (
        <Lab.Alert className={classes.error} severity="error">
          {error.message}
        </Lab.Alert>
      )}

      <div className={classes.actions}>
        <Database onChange={setExecutionContext} value={executionContext} />
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
