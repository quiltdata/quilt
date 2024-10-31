import * as React from 'react'
import AceEditor from 'react-ace'
// import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import { useConfirm } from 'components/Dialog'
import Skeleton from 'components/Skeleton'
// import * as Notifications from 'containers/Notifications'
import * as Model from 'model'
// import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

// import * as requests from '../requests'

import * as State from './State'
import Database from './Database'

const ATHENA_REF_INDEX = 'https://aws.amazon.com/athena/'
const ATHENA_REF_SQL =
  'https://docs.aws.amazon.com/athena/latest/ug/ddl-sql-reference.html'
const ATHENA_REF_FUNCTIONS =
  'https://docs.aws.amazon.com/athena/latest/ug/presto-functions.html'

function HelperText() {
  return (
    <M.FormHelperText>
      Quilt uses AWS Athena SQL. Learn more:{' '}
      <StyledLink href={ATHENA_REF_INDEX} target="_blank">
        Introduction
      </StyledLink>
      ,{' '}
      <StyledLink href={ATHENA_REF_SQL} target="_blank">
        SQL Reference for Amazon Athena
      </StyledLink>
      ,{' '}
      <StyledLink href={ATHENA_REF_FUNCTIONS} target="_blank">
        Functions in Amazon Athena
      </StyledLink>
      .
    </M.FormHelperText>
  )
}

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
  const { query: selectedQuery } = State.use()

  if (!Model.isFulfilled(selectedQuery)) {
    return <h1>Not ready</h1>
  }
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
      <HelperText />
    </div>
  )
}

// function useQueryRun(
//   bucket: string,
//   workgroup: requests.athena.Workgroup,
//   queryExecutionId?: string,
// ) {
//   const { urls } = NamedRoutes.use()
//   const history = RRDom.useHistory()
//   const [loading, setLoading] = React.useState(false)
//   const [error, setError] = React.useState<Error | undefined>()
//   const runQuery = requests.athena.useQueryRun(workgroup)
//   const { push: notify } = Notifications.use()
//   const goToExecution = React.useCallback(
//     (id: string) => history.push(urls.bucketAthenaExecution(bucket, workgroup, id)),
//     [bucket, history, urls, workgroup],
//   )
//   const onSubmit = React.useCallback(
//     async (value: string, executionContext: requests.athena.ExecutionContext | null) => {
//       setLoading(true)
//       setError(undefined)
//       try {
//         const { id } = await runQuery(value, executionContext)
//         if (id === queryExecutionId) notify('Query execution results remain unchanged')
//         setLoading(false)
//         goToExecution(id)
//       } catch (e) {
//         setLoading(false)
//         if (e instanceof Error) {
//           setError(e)
//         } else {
//           throw e
//         }
//       }
//     },
//     [goToExecution, notify, runQuery, queryExecutionId],
//   )
//   return React.useMemo(
//     () => ({
//       loading,
//       error,
//       onSubmit,
//     }),
//     [loading, error, onSubmit],
//   )
// }

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
      <HelperText />
      <Skeleton className={classes.button} animate />
    </div>
  )
}

export { FormSkeleton as Skeleton }

const useFormStyles = M.makeStyles((t) => ({
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    margin: t.spacing(2, 0),
    [t.breakpoints.up('sm')]: {
      alignItems: 'center',
    },
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  database: {
    [t.breakpoints.up('sm')]: {
      width: '50%',
    },
    [t.breakpoints.down('sm')]: {
      marginBottom: t.spacing(2),
    },
  },
  error: {
    margin: t.spacing(1, 0, 0),
  },
}))

interface FormProps {
  className?: string
}

export function Form({ className }: FormProps) {
  const classes = useFormStyles()
  const { catalogName, database, queryBody, setQueryBody, submit, execution } =
    State.use()

  // const executionContext = React.useMemo<requests.athena.ExecutionContext | null>(
  //   () =>
  //     Model.isSelected(catalogName) && Model.isSelected(database)
  //       ? {
  //           catalogName,
  //           database,
  //         }
  //       : null,
  //   [catalogName, database],
  // )
  // const { loading, error, onSubmit } = useQueryRun(bucket, workgroup, query?.id)
  const confirm = useConfirm({
    onSubmit: () => submit(),
    title: 'Confirm',
  })
  // const confirm = useConfirm({
  //   onSubmit: (confirmed) => {
  //     if (!Model.isSelected(query)) return // TODO: throw error
  //     if (confirmed) {
  //       if (!query?.body) {
  //         throw new Error('Query is not set')
  //       }
  //       onSubmit(query!.body, executionContext)
  //     }
  //   },
  //   submitTitle: 'Proceed',
  //   title: 'Execution context is not set',
  // })
  // const handleSubmit = React.useCallback(() => {
  //   if (!Model.isSelected(query)) return // TODO: throw error
  //   if (!query?.body) return
  //   if (!executionContext) {
  //     return confirm.open()
  //   }
  //   onSubmit(query.body, executionContext)
  // }, [confirm, executionContext, onSubmit, value])

  if (Model.isError(queryBody)) {
    return (
      <Lab.Alert className={classes.error} severity="error">
        {queryBody.message}
      </Lab.Alert>
    )
  }
  if (Model.isPending(queryBody)) {
    return <h1>Loading…</h1>
  }

  return (
    <div className={className}>
      {confirm.render(
        <M.Typography>
          Data catalog and database are not set. Run query without them?
        </M.Typography>,
      )}
      <EditorField onChange={setQueryBody} query={queryBody || ''} />

      <div className={classes.actions}>
        <Database className={classes.database} />
        <M.Button
          variant="contained"
          color="primary"
          disabled={
            (Model.isPending(execution) || !Model.isSelected(catalogName),
            !Model.isSelected(database) || !queryBody)
          }
          onClick={submit}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}
