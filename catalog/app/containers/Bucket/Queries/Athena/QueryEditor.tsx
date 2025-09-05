import * as React from 'react'
import AceEditor from 'react-ace'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import 'ace-builds/src-noconflict/mode-sql'
import 'ace-builds/src-noconflict/theme-eclipse'

import Lock from 'components/Lock'
import Skeleton from 'components/Skeleton'
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
    margin: t.spacing(2, 0, 1),
  },
}))

function EditorField() {
  const classes = useStyles()
  const { queryBody, queryRun } = Model.use()

  const editorProps = React.useMemo(
    () => ({ $blockScrolling: true, readonly: !Model.isReady(queryRun) }),
    [queryRun],
  )

  const handleChange = React.useCallback(
    (value: string) => {
      queryBody.setValue(Model.Payload(value))
    },
    [queryBody],
  )

  if (!Model.isReady(queryBody.value)) {
    return <FormSkeleton />
  }

  if (Model.isError(queryBody.value)) {
    return <Lab.Alert severity="error">{queryBody.value.error.message}</Lab.Alert>
  }

  return (
    <div>
      <M.Typography className={classes.header} variant="body1">
        Query body
      </M.Typography>
      <M.Paper className={classes.editor}>
        <AceEditor
          editorProps={editorProps}
          height="200px"
          mode="sql"
          onChange={handleChange}
          theme="eclipse"
          value={queryBody.value.data || ''}
          width="100%"
        />
        {!Model.isReady(queryRun) && <Lock />}
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
  close: () => void
  submit: () => void
}

function FormConfirm({ close, submit }: FormConfirmProps) {
  return (
    <>
      <M.DialogContent>
        Database is not selected. Run the query without it?
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

export { FormSkeleton as Skeleton }

const useFormStyles = M.makeStyles((t) => ({
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    margin: t.spacing(2, 0, 4),
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

  const { submit, queryRun } = Model.use()

  const openDialog = Dialogs.use()
  const handleSubmit = React.useCallback(async () => {
    const output = await submit(false)
    if (output === Model.NO_DATABASE) {
      openDialog(({ close }) => <FormConfirm close={close} submit={() => submit(true)} />)
    }
  }, [openDialog, submit])

  return (
    <div className={className}>
      <EditorField />

      {Model.isError(queryRun) && (
        <Lab.Alert className={classes.error} severity="error">
          {queryRun.error.message}
        </Lab.Alert>
      )}

      <div className={classes.actions}>
        <Database className={classes.database} />
        <M.Button
          variant="contained"
          color="primary"
          disabled={!Model.isReady(queryRun)}
          onClick={handleSubmit}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}
