// import cx from 'classnames'
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
// import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

// import * as requests from '../requests'

import * as State from './State'
import Database from './Database'
import * as Model from './model'

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

interface EditorFieldProps {}

function EditorField({}: EditorFieldProps) {
  const classes = useStyles()
  const { queryBody } = State.use()
  if (Model.isError(queryBody.value)) {
    return <Lab.Alert severity="error">{queryBody.value.message}</Lab.Alert>
  }
  if (!Model.hasData(queryBody.value)) {
    return <FormSkeleton />
  }

  return (
    <div>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper className={classes.editor}>
        <AceEditor
          editorProps={{ $blockScrolling: true }}
          height="200px"
          mode="sql"
          onChange={queryBody.setValue}
          theme="eclipse"
          value={queryBody.value}
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
  // button: {
  //   height: t.spacing(4),
  //   marginTop: t.spacing(2),
  //   width: t.spacing(14),
  // },
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
  className?: string
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
      {/*
      <Skeleton className={classes.button} animate />
        */}
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
  className: string
}

export function Form({ className }: FormProps) {
  const classes = useFormStyles()

  const { catalogName, database, queryBody, submit, execution } = State.use()

  const confirm = useConfirm({
    onSubmit: () => submit(),
    title: 'Confirm',
  })

  return (
    <div className={className}>
      {confirm.render(
        <M.Typography>
          Data catalog and database are not set. Run query without them?
        </M.Typography>,
      )}
      <EditorField />

      <div className={classes.actions}>
        <Database className={classes.database} />
        <M.Button
          variant="contained"
          color="primary"
          disabled={
            !Model.isObtained(execution) ||
            !Model.hasData(catalogName) ||
            !Model.hasData(database) ||
            !queryBody
          }
          onClick={submit}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}
