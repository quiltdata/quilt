import * as React from 'react'
import AceEditor from 'react-ace'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import Lock from 'components/Lock'
import Skeleton from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Dialogs from 'utils/GlobalDialogs'
import StyledLink from 'utils/StyledLink'

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
    position: 'relative',
  },
  header: {
    margin: t.spacing(0, 0, 1),
  },
}))

function EditorField() {
  const classes = useStyles()
  const { queryBody, running } = Model.use()

  if (Model.isNone(queryBody.value)) {
    return null
  }

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
        {running && <Lock />}
      </M.Paper>
      <HelperText />
    </div>
  )
}

const useFormSkeletonStyles = M.makeStyles((t) => ({
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
    </div>
  )
}

interface FormConfirmProps {
  data: Model.Value<Model.QueryRun>
  close: () => void
  submit: () => void
}

function FormConfirm({ close, data, submit }: FormConfirmProps) {
  if (data === Model.NO_CATALOG_NAME || data === Model.NO_DATABASE) {
    return (
      <>
        <M.DialogContent>
          {data === Model.NO_CATALOG_NAME && 'Catalog name '}
          {data === Model.NO_DATABASE && 'Database '}
          is not set. Run query without them?
        </M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={close}>Close</M.Button>
          <M.Button
            onClick={() => {
              close()
              submit()
            }}
          >
            Confirm, run without
          </M.Button>
        </M.DialogActions>
      </>
    )
  }
  if (Model.isError(data)) {
    return (
      <>
        <M.DialogContent>Error: {data.message}</M.DialogContent>
        <M.DialogActions>
          <M.Button onClick={close}>Close</M.Button>
        </M.DialogActions>
      </>
    )
  }
  if (Model.isLoading(data)) {
    // This shouldn't happen
    throw new Error('Unexpected loading state. Submit button should be disabled')
  }
  return null
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

  const { bucket, queryExecutionId, readyToRun, running, submit, workgroup } = Model.use()

  const { push: notify } = Notifications.use()
  const { urls } = NamedRoutes.use()
  const history = RRDom.useHistory()
  const goToExecution = React.useCallback(
    (id: string) => {
      if (queryExecutionId === id) {
        notify('Query execution results remain unchanged')
      } else {
        history.push(urls.bucketAthenaExecution(bucket, workgroup, id))
      }
    },
    [bucket, history, queryExecutionId, notify, urls, workgroup],
  )

  const openDialog = Dialogs.use()
  const submitWithDefaults = React.useCallback(async () => {
    const data = await submit(true)
    if (!Model.hasData(data)) {
      return openDialog(({ close }) => (
        <FormConfirm
          data={data}
          close={close}
          submit={() => {
            throw new Error('Unexpected state')
          }}
        />
      ))
    }
    goToExecution(data.id)
  }, [goToExecution, openDialog, submit])
  const handleSubmit = React.useCallback(async () => {
    const data = await submit()
    if (!Model.hasData(data)) {
      return openDialog(({ close }) => (
        <FormConfirm data={data} close={close} submit={() => submitWithDefaults()} />
      ))
    }
    goToExecution(data.id)
  }, [goToExecution, openDialog, submit, submitWithDefaults])

  return (
    <div className={className}>
      <EditorField />

      <div className={classes.actions}>
        <Database className={classes.database} />
        <M.Button
          variant="contained"
          color="primary"
          disabled={!readyToRun || running}
          onClick={handleSubmit}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}
