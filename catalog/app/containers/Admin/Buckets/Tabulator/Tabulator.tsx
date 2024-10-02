import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import { useConfirm } from 'components/Dialog'
import TextEditorSkeleton from 'components/FileEditor/Skeleton'
import Skel from 'components/Skeleton'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import { mkFormError, mapInputErrors } from 'utils/formTools'
import * as validators from 'utils/validators'

import * as Form from '../../Form'

import * as OnDirty from '../OnDirty'

import RENAME_TABULATOR_TABLE_MUTATION from '../gql/TabulatorTablesRename.generated'
import SET_TABULATOR_TABLE_MUTATION from '../gql/TabulatorTablesSet.generated'

const ConfigEditorModule = () => import('./ConfigEditor')

const ConfigEditor = React.lazy(() =>
  ConfigEditorModule().then((m) => ({ default: m.ConfigEditor })),
)

const validateTable: FF.FieldValidator<string> = (...args) =>
  ConfigEditorModule().then((m) => m.validateTable(...args))

function anyIn(obj: FF.ValidationErrors, keys: string[]) {
  if (!obj) return false
  const entries = Object.entries(obj)
  if (!entries.length) return false
  return entries.find(([key, value]) => keys.includes(key) && !!value)
}

interface InlineErrorProps {
  keys: string[]
  errors?: Record<string, string>
}

function InlineError({ keys, errors: errorsDict = {} }: InlineErrorProps) {
  const state = RF.useFormState()
  const error = React.useMemo(
    () =>
      state.error ||
      state.submitError ||
      anyIn(state.errors, keys) ||
      anyIn(state.submitErrors, keys),
    [keys, state],
  )
  return (
    <Form.FormError
      /* @ts-expect-error */
      component="span"
      errors={errorsDict}
      error={error}
      margin="none"
    />
  )
}

const isEmpty = (obj: Record<string, any>) => {
  const values = Object.values(obj)
  if (values.length === 0) return true
  return values.every((x) => !x)
}

const useRenameStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
  },
  button: {
    marginLeft: t.spacing(2),
  },
}))

interface NameFormProps {
  className: string
  disabled?: boolean
  onCancel: () => void
  onSubmit: (values: FormValuesRenameTable) => void
  tabulatorTable: Model.GQLTypes.TabulatorTable
}

const nameErrorsKeys = ['tableName']

function NameForm({
  className,
  disabled,
  onCancel,
  onSubmit,
  tabulatorTable,
}: NameFormProps) {
  const classes = useRenameStyles()
  const { onChange: onFormSpy } = OnDirty.use()
  return (
    <RF.Form initialValues={tabulatorTable} onSubmit={onSubmit}>
      {({ handleSubmit, submitFailed }) => (
        <form onSubmit={handleSubmit} className={cx(classes.root, className)}>
          <OnDirty.Spy onChange={onFormSpy} />
          <RF.Field component="input" type="hidden" name="tableName" />
          <RF.Field
            component={Form.Field}
            name="newTableName"
            size="small"
            onClick={(event: Event) => event.stopPropagation()}
            fullWidth
            initialValue={tabulatorTable.name}
            errors={{
              required: 'Enter a table name',
            }}
            helperText={submitFailed && <InlineError keys={nameErrorsKeys} />}
            disabled={disabled}
          />
          <M.Button
            className={classes.button}
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              handleSubmit()
            }}
            variant="contained"
            color="primary"
            disabled={disabled}
          >
            Rename
          </M.Button>
          <M.Button
            className={classes.button}
            size="small"
            onClick={(event) => {
              event.stopPropagation()
              onCancel()
            }}
            color="primary"
            disabled={disabled}
          >
            Cancel
          </M.Button>
        </form>
      )}
    </RF.Form>
  )
}

const useConfigFormStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: t.spacing(2),
  },
  button: {
    marginLeft: 'auto',
  },
  bottom: {
    marginTop: t.spacing(1),
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
}))

interface ConfigFormProps {
  className: string
  disabled?: boolean
  onSubmit: (values: FormValuesSetTable) => void
  tabulatorTable: Model.GQLTypes.TabulatorTable
}

const configErrorsKeys = ['tableName']

function ConfigForm({ className, disabled, onSubmit, tabulatorTable }: ConfigFormProps) {
  const classes = useConfigFormStyles()
  const { onChange: onFormSpy } = OnDirty.use()
  return (
    <RF.Form initialValues={tabulatorTable} onSubmit={onSubmit}>
      {({ handleSubmit, submitFailed }) => (
        <form onSubmit={handleSubmit} className={cx(classes.root, className)}>
          <OnDirty.Spy onChange={onFormSpy} />
          <RF.Field component="input" type="hidden" name="tableName" />
          <RF.Field
            component={ConfigEditor}
            errors={{
              required: 'Enter config content',
              invalid: 'YAML is invalid',
            }}
            name="config"
            validate={validators.composeAsync(
              validators.required as FF.FieldValidator<string>,
              validateTable,
            )}
            disabled={disabled}
            autoFocus
          />
          <div className={classes.bottom}>
            {submitFailed && <InlineError keys={configErrorsKeys} />}
            <M.Button
              className={classes.button}
              color="primary"
              disabled={disabled}
              onClick={handleSubmit}
              size="small"
              type="submit"
              variant="contained"
            >
              Save
            </M.Button>
          </div>
        </form>
      )}
    </RF.Form>
  )
}

interface TableMenuProps {
  disabled?: boolean
  onDelete: () => void
  onRename: () => void
}

function TableMenu({ disabled, onRename, onDelete }: TableMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  return (
    <>
      <M.IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        size="small"
        disabled={disabled}
      >
        <M.Icon>more_vert</M.Icon>
      </M.IconButton>
      <M.Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <M.MenuItem
          onClick={() => {
            setAnchorEl(null)
            onRename()
          }}
          disabled={disabled}
        >
          Rename
        </M.MenuItem>
        <M.MenuItem
          onClick={() => {
            setAnchorEl(null)
            onDelete()
          }}
          disabled={disabled}
        >
          Delete
        </M.MenuItem>
      </M.Menu>
    </>
  )
}

interface FormValuesSetTable {
  tableName: Model.GQLTypes.TabulatorTable['name']
  config: Model.GQLTypes.TabulatorTable['config']
}

interface FormValuesRenameTable {
  tableName: Model.GQLTypes.TabulatorTable['name']
  newTableName: Model.GQLTypes.TabulatorTable['name']
}

interface FormValuesDeleteTable {
  tableName: Model.GQLTypes.TabulatorTable['name']
}

const useEmptyStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    marginBottom: t.spacing(2),
  },
}))

interface EmptyProps {
  className: string
  onClick: () => void
}

function Empty({ className, onClick }: EmptyProps) {
  const classes = useEmptyStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="subtitle1" className={classes.title}>
        No tables configured
      </M.Typography>
      <M.Button variant="contained" color="primary" size="small" onClick={onClick}>
        Add table
      </M.Button>
    </div>
  )
}

const useAddTableSkeletonStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
  },
  name: {
    marginBottom: t.spacing(1),
    height: t.spacing(3),
  },
  buttons: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    marginTop: t.spacing(2),
    height: t.spacing(4),
    width: t.spacing(15),
  },
}))

function AddTableSkeleton() {
  const classes = useAddTableSkeletonStyles()
  return (
    <div className={classes.root}>
      <Skel className={classes.name} />
      <TextEditorSkeleton height={18} />
      <div className={classes.buttons}>
        <Skel className={classes.button} />
      </div>
    </div>
  )
}

const useAddTableStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  button: {
    marginLeft: 'auto',
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  editor: {
    marginBottom: t.spacing(1),
  },
  formBottom: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
}))

interface AddTableProps {
  disabled?: boolean
  onCancel: () => void
  onSubmit: (values: FormValuesSetTable) => Promise<FF.SubmissionErrors | undefined>
}

function AddTable({ disabled, onCancel, onSubmit }: AddTableProps) {
  const classes = useAddTableStyles()
  const { onChange: onFormSpy } = OnDirty.use()
  return (
    <RF.Form onSubmit={onSubmit}>
      {({ handleSubmit, error, submitError, submitFailed }) => (
        <form onSubmit={handleSubmit} className={classes.root}>
          <OnDirty.Spy onChange={onFormSpy} />
          <RF.Field
            component={Form.Field}
            disabled={disabled}
            errors={{
              required: 'Enter a table name',
            }}
            fullWidth
            label="Table name"
            margin="normal"
            name="tableName"
            size="small"
            validate={validators.required as FF.FieldValidator<string>}
            variant="outlined"
          />
          <RF.Field
            className={classes.editor}
            component={ConfigEditor}
            errors={{
              required: 'Enter config content',
              invalid: 'YAML is invalid',
            }}
            name="config"
            validate={validators.composeAsync(
              validators.required as FF.FieldValidator<string>,
              validateTable,
            )}
            disabled={disabled}
          />
          <div className={classes.formBottom}>
            {submitFailed && (
              <Form.FormError
                error={error || submitError}
                errors={{ unexpected: 'Something went wrong' }}
                margin="none"
              />
            )}
            <M.Button
              className={classes.button}
              color="primary"
              disabled={disabled}
              size="small"
              onClick={onCancel}
            >
              Cancel
            </M.Button>
            <M.Button
              className={classes.button}
              color="primary"
              disabled={disabled}
              onClick={handleSubmit}
              size="small"
              type="submit"
              variant="contained"
            >
              Add
            </M.Button>
          </div>
        </form>
      )}
    </RF.Form>
  )
}

const useTableStyles = M.makeStyles((t) => ({
  config: {
    flexGrow: 1,
  },
  name: {
    flexGrow: 1,
    marginRight: t.spacing(2),
    marginTop: '5px', // to make a visual substitute for the ListItemText
  },
  configPlaceholder: {
    minHeight: t.spacing(18),
  },
}))

interface TableProps {
  disabled?: boolean
  onDelete: (values: FormValuesDeleteTable) => Promise<FF.SubmissionErrors | undefined>
  onRename: (values: FormValuesRenameTable) => Promise<FF.SubmissionErrors | undefined>
  onSubmit: (values: FormValuesSetTable) => Promise<FF.SubmissionErrors | undefined>
  tabulatorTable: Model.GQLTypes.TabulatorTable
}

function Table({ disabled, onDelete, onRename, onSubmit, tabulatorTable }: TableProps) {
  const classes = useTableStyles()
  const [open, setOpen] = React.useState<boolean | null>(null)
  const [editName, setEditName] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<Record<string, string>>({})
  const confirm = useConfirm({
    title: `You are about to delete "${tabulatorTable.name}" table`,
    submitTitle: 'Delete',
    onSubmit: React.useCallback(
      async (confirmed) => {
        if (!confirmed) return
        const error = await onDelete({ tableName: tabulatorTable.name })
        setDeleteError(error || {})
      },
      [onDelete, tabulatorTable],
    ),
  })

  return (
    <>
      {confirm.render(<></>)}
      <M.ListItem button onClick={() => setOpen((x) => !x)} disabled={disabled}>
        <M.ListItemIcon>
          <M.Icon>{open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</M.Icon>
        </M.ListItemIcon>
        {editName && isEmpty(deleteError) ? (
          <NameForm
            className={classes.name}
            onSubmit={onRename}
            onCancel={() => setEditName(false)}
            disabled={disabled}
            tabulatorTable={tabulatorTable}
          />
        ) : (
          <M.ListItemText
            primary={tabulatorTable.name}
            secondary={
              <Form.FormError
                /* @ts-expect-error */
                component="span"
                errors={{}}
                error={deleteError.name || deleteError[FF.FORM_ERROR]}
                margin="none"
              />
            }
          />
        )}
        <M.ListItemSecondaryAction>
          <TableMenu
            disabled={disabled}
            onDelete={confirm.open}
            onRename={() => setEditName(true)}
          />
        </M.ListItemSecondaryAction>
      </M.ListItem>
      <M.Collapse in={!!open}>
        <M.ListItem disabled={editName}>
          {open !== null && (
            <React.Suspense fallback={<TextEditorSkeleton height={18} />}>
              <ConfigForm
                className={classes.config}
                disabled={disabled || editName}
                onSubmit={onSubmit}
                tabulatorTable={tabulatorTable}
              />
            </React.Suspense>
          )}
        </M.ListItem>
      </M.Collapse>
      <M.Divider />
    </>
  )
}

function parseResponseError(
  r: Exclude<Model.GQLTypes.BucketSetTabulatorTableResult, Model.GQLTypes.BucketConfig>,
  mappings?: Record<string, string>,
): FF.SubmissionErrors | undefined {
  switch (r.__typename) {
    case 'InvalidInput':
      return mapInputErrors(r.errors, mappings)
    case 'OperationError':
      return mkFormError(r.message)
    default:
      return assertNever(r)
  }
}

const useTablesStyles = M.makeStyles((t) => ({
  textPlaceholder: {
    height: t.spacing(3.5),
  },
}))

interface TablesProps {
  adding: boolean
  bucketName: string
  onAdding: (v: boolean) => void
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

function Tables({ adding, bucketName, onAdding, tabulatorTables }: TablesProps) {
  const classes = useTablesStyles()

  const renameTabulatorTable = GQL.useMutation(RENAME_TABULATOR_TABLE_MUTATION)
  const setTabulatorTable = GQL.useMutation(SET_TABULATOR_TABLE_MUTATION)
  const { push: notify } = Notifications.use()

  const [submitting, setSubmitting] = React.useState(false)

  const onDelete = React.useCallback(
    async ({
      tableName,
    }: FormValuesDeleteTable): Promise<FF.SubmissionErrors | undefined> => {
      try {
        setSubmitting(true)
        const response = await setTabulatorTable({ bucketName, tableName, config: null })
        // Generated `InputError` lacks optional properties and not infered correctly
        const r = response.admin
          .bucketSetTabulatorTable as Model.GQLTypes.BucketSetTabulatorTableResult
        setSubmitting(false)
        if (r.__typename === 'BucketConfig') {
          notify(`Successfully deleted ${tableName} table`)
          return undefined
        }
        return parseResponseError(r, {
          tableName: 'tableName',
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error deleting table')
        // eslint-disable-next-line no-console
        console.error(e)
        setSubmitting(false)
        return mkFormError('unexpected')
      }
    },
    [bucketName, notify, setTabulatorTable],
  )

  const onRename = React.useCallback(
    async (values: FormValuesRenameTable): Promise<FF.SubmissionErrors | undefined> => {
      try {
        setSubmitting(true)
        const response = await renameTabulatorTable({
          bucketName,
          ...values,
        })
        const r = response.admin
          .bucketRenameTabulatorTable as Model.GQLTypes.BucketSetTabulatorTableResult
        setSubmitting(false)
        if (r.__typename === 'BucketConfig') {
          notify(`Successfully updated ${values.tableName} table`)
          return undefined
        }
        return parseResponseError(r, {
          config: 'config',
          newTableName: 'newTableName',
          tableName: 'newTableName',
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating table')
        // eslint-disable-next-line no-console
        console.error(e)
        setSubmitting(false)
        return mkFormError('unexpected')
      }
    },
    [bucketName, notify, renameTabulatorTable],
  )

  const onSubmit = React.useCallback(
    async (values: FormValuesSetTable): Promise<FF.SubmissionErrors | undefined> => {
      try {
        setSubmitting(true)
        const response = await setTabulatorTable({ bucketName, ...values })
        const r = response.admin
          .bucketSetTabulatorTable as Model.GQLTypes.BucketSetTabulatorTableResult
        setSubmitting(false)
        if (r.__typename === 'BucketConfig') {
          notify(`Successfully updated ${values.tableName} table`)
          return undefined
        }
        return parseResponseError(r, {
          config: 'config',
          tableName: 'tableName',
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error creating table')
        // eslint-disable-next-line no-console
        console.error(e)
        setSubmitting(false)
        return mkFormError('unexpected')
      }
    },
    [bucketName, notify, setTabulatorTable],
  )

  const onSubmitNew = React.useCallback(
    async (values: FormValuesSetTable): Promise<FF.SubmissionErrors | undefined> => {
      const error = await onSubmit(values)
      if (!error) {
        onAdding(false)
      }
      return error
    },
    [onSubmit, onAdding],
  )

  return (
    <M.List>
      {tabulatorTables.map((tabulatorTable) => (
        <Table
          key={tabulatorTable.name}
          disabled={submitting}
          onDelete={onDelete}
          onRename={onRename}
          onSubmit={onSubmit}
          tabulatorTable={tabulatorTable}
        />
      ))}
      {adding ? (
        <M.ListItem>
          <React.Suspense fallback={<AddTableSkeleton />}>
            <AddTable
              disabled={submitting}
              onCancel={() => onAdding(false)}
              onSubmit={onSubmitNew}
            />
          </React.Suspense>
        </M.ListItem>
      ) : (
        <M.ListItem>
          <M.ListItemText primary={<div className={classes.textPlaceholder}></div>} />
          <M.ListItemSecondaryAction>
            <M.Button disabled={submitting} onClick={() => onAdding(true)} type="button">
              Add table
            </M.Button>
          </M.ListItemSecondaryAction>
        </M.ListItem>
      )}
    </M.List>
  )
}

const useStyles = M.makeStyles((t) => ({
  empty: {
    paddingBottom: t.spacing(2),
  },
}))

interface TabulatorProps {
  bucket: string
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

/** Have to be suspended because of `<TextEditor />` and `loadMode(...)` */
export default function Tabulator({
  bucket: bucketName,
  tabulatorTables,
}: TabulatorProps) {
  const classes = useStyles()
  const [adding, setAdding] = React.useState(false)

  if (!tabulatorTables.length && !adding) {
    return <Empty className={classes.empty} onClick={() => setAdding(true)} />
  }

  return (
    <Tables
      adding={adding}
      bucketName={bucketName}
      onAdding={setAdding}
      tabulatorTables={tabulatorTables}
    />
  )
}
