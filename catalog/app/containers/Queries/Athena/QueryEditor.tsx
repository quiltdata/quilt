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

/**
 * Shown as ghost text in the empty editor, and inserted only when the user asks
 * for it — never pre-filled into `queryBody`, so it can't be run by accident.
 *
 * Queries the per-bucket Iceberg package index Quilt maintains for every
 * registered bucket (see docs/advanced-features/iceberg-tables.md): the
 * `{bucket}_package_tag` table, whose `latest` tag names the current revision of
 * each package. The bucket name has to be substituted, which is the point — it
 * shows the shape of a real query without pretending to be runnable as-is.
 */
const EXAMPLE_QUERY = `-- The latest revision of every package in a bucket.
-- Replace my-bucket with one of your bucket names.
SELECT pkg_name, top_hash
FROM "my-bucket_package_tag"
WHERE tag_name = 'latest'
LIMIT 10`

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
    // Ace renders its placeholder as scaled-down Arial with a margin of its
    // own, which reads as stray UI text rather than as example SQL.
    '& .ace_placeholder': {
      fontFamily: t.typography.monospace.fontFamily,
      margin: 0,
      transform: 'none',
    },
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    margin: t.spacing(2, 0, 1),
  },
}))

function EditorField() {
  const classes = useStyles()
  const { queryBody, queryRun } = Model.use()

  const editorProps = React.useMemo(
    () => ({ $blockScrolling: true, readonly: Model.isLoading(queryRun) }),
    [queryRun],
  )

  const { setValue } = queryBody
  const insertExample = React.useCallback(() => setValue(EXAMPLE_QUERY), [setValue])

  if (Model.isNone(queryBody.value)) {
    return null
  }

  if (Model.isError(queryBody.value)) {
    return <Lab.Alert severity="error">{queryBody.value.message}</Lab.Alert>
  }

  if (!Model.hasValue(queryBody.value)) {
    return <FormSkeleton />
  }

  return (
    <div>
      <div className={classes.header}>
        <M.Typography variant="body1">Query body</M.Typography>
        {!queryBody.value && (
          <M.Button
            color="primary"
            disabled={Model.isLoading(queryRun)}
            onClick={insertExample}
            size="small"
          >
            Insert example
          </M.Button>
        )}
      </div>
      <M.Paper className={classes.editor} variant="outlined">
        <AceEditor
          editorProps={editorProps}
          height="200px"
          mode="sql"
          onChange={queryBody.setValue}
          placeholder={EXAMPLE_QUERY}
          // The vertical rule Ace draws at column 80 has no meaning for SQL and
          // reads as a stray border down the middle of the card.
          showPrintMargin={false}
          theme="eclipse"
          value={queryBody.value || ''}
          width="100%"
        />
        {Model.isLoading(queryRun) && <Lock />}
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
  run: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  reason: {
    margin: t.spacing(0.5, 0, 0),
  },
}))

/**
 * Why `Run query` is disabled, in the same order `useQueryRun` gives up, or
 * `null` when it is enabled. A button that is dead with no stated cause is the
 * dead-affordance failure mode DESIGN.md rules out.
 */
function useRunDisabledReason(): string | null {
  const { catalogName, database, queryBody, queryRun, workgroup } = Model.use()
  if (Model.isReady(queryRun)) return null
  if (Model.isLoading(queryRun)) return 'Running…'
  if (!Model.hasData(workgroup.data)) return 'Select a workgroup first'
  if (!Model.hasValue(catalogName.value) || !Model.hasValue(database.value)) {
    return 'Loading the data catalog and database'
  }
  if (!Model.hasData(queryBody.value)) return 'Write a query, or insert the example'
  return null
}

interface FormProps {
  className: string
}

export function Form({ className }: FormProps) {
  const classes = useFormStyles()

  const { submit, queryRun } = Model.use()
  const disabledReason = useRunDisabledReason()

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
          {queryRun.message}
        </Lab.Alert>
      )}

      <div className={classes.actions}>
        <Database className={classes.database} />
        <div className={classes.run}>
          <M.Button
            variant="contained"
            color="primary"
            disabled={!Model.isReady(queryRun)}
            onClick={handleSubmit}
          >
            Run query
          </M.Button>
          {disabledReason && (
            <M.FormHelperText className={classes.reason}>
              {disabledReason}
            </M.FormHelperText>
          )}
        </div>
      </div>
    </div>
  )
}
