import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import tabulatorTableSchema from 'schemas/tabulatorTable.yml.json'

import { useConfirm } from 'components/Dialog'
import { loadMode } from 'components/FileEditor/loader'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import { JsonInvalidAgainstSchema } from 'utils/error'
import { mkFormError, mapInputErrors } from 'utils/formTools'
import { makeSchemaValidator } from 'utils/json-schema'
import * as validators from 'utils/validators'
import * as yaml from 'utils/yaml'

import * as Form from '../Form'

import * as OnDirty from './OnDirty'

import SET_TABULATOR_TABLE_MUTATION from './gql/TabulatorTablesSet.generated'
import RENAME_TABULATOR_TABLE_MUTATION from './gql/TabulatorTablesRename.generated'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

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

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type FormValuesSetTable = Pick<Model.GQLTypes.TabulatorTable, 'name' | 'config'>

type FormValuesRenameTable = Pick<Model.GQLTypes.TabulatorTable, 'name'> & {
  newTableName: string
}

type FormValuesDeleteTable = Pick<Model.GQLTypes.TabulatorTable, 'name'>

type YamlEditorFieldProps = RF.FieldRenderProps<string> &
  M.TextFieldProps & { className: string }

function YamlEditorField({ errors, input, meta, ...props }: YamlEditorFieldProps) {
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined

  const [key, setKey] = React.useState(0)
  const reset = React.useCallback(() => setKey((k) => k + 1), [])
  React.useEffect(() => {
    if (meta.pristine) reset()
  }, [meta.pristine, reset])

  return (
    <TextEditor
      {...props}
      error={errorMessage ? new Error(errorMessage) : null}
      initialValue={meta.initial}
      key={key}
      leadingChange={false}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
    />
  )
}

const validateYaml: FF.FieldValidator<string> = (inputStr?: string) => {
  const error = yaml.validate(inputStr)
  if (error) {
    return 'invalid'
  }
  return undefined
}

const validateTable: FF.FieldValidator<string> = (inputStr?: string) => {
  const data = yaml.parse(inputStr)
  const validator = makeSchemaValidator(tabulatorTableSchema)
  const errors = validator(data)
  if (errors.length) {
    return new JsonInvalidAgainstSchema({ errors }).message
  }
  return undefined
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
            name="name"
            size="small"
            validate={validators.required as FF.FieldValidator<string>}
            variant="outlined"
          />
          <RF.Field
            className={classes.editor}
            component={YamlEditorField}
            errors={{
              required: 'Enter config content',
              invalid: 'YAML is invalid',
            }}
            name="config"
            validate={validators.composeAnd(
              validators.required as FF.FieldValidator<string>,
              validateYaml,
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

const useTabulatorRowStyles = M.makeStyles((t) => ({
  root: {},
  name: {
    marginRight: t.spacing(2),
  },
  button: {
    marginLeft: 'auto',
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  actions: {
    display: 'flex',
  },
  editor: {
    marginBottom: t.spacing(1),
  },
  delete: {
    color: t.palette.error.main,
  },
  config: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    paddingBottom: t.spacing(2),
  },
  nameForm: {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
  },
  submit: {
    marginTop: t.spacing(1),
  },
  formBottom: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
}))

interface TabulatorRowProps {
  disabled?: boolean
  onDelete: (values: FormValuesDeleteTable) => Promise<FF.SubmissionErrors | undefined>
  onRename: (values: FormValuesRenameTable) => Promise<FF.SubmissionErrors | undefined>
  onSubmit: (values: FormValuesSetTable) => Promise<FF.SubmissionErrors | undefined>
  tabulatorTable: Model.GQLTypes.TabulatorTable
}

function TabulatorRow({
  disabled,
  onDelete,
  onRename,
  onSubmit,
  tabulatorTable,
}: TabulatorRowProps) {
  const classes = useTabulatorRowStyles()
  const [open, setOpen] = React.useState(false)
  const [editName, setEditName] = React.useState(false)

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const [deleteError, setDeleteError] = React.useState<Record<string, string>>({})
  const handleDelete = React.useCallback(async () => {
    const error = await onDelete(tabulatorTable)
    setDeleteError(error || {})
  }, [onDelete, tabulatorTable])
  const { onChange: onFormSpy } = OnDirty.use()
  const confirm = useConfirm({
    title: `You are about to delete "${tabulatorTable.name}" table`,
    submitTitle: 'Delete',
    onSubmit: React.useCallback(
      (confirmed) => confirmed && handleDelete(),
      [handleDelete],
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
          <RF.Form initialValues={tabulatorTable} onSubmit={onRename}>
            {({ handleSubmit }) => (
              <form onSubmit={handleSubmit} className={classes.nameForm}>
                <OnDirty.Spy onChange={onFormSpy} />
                <RF.Field
                  component={Form.Field}
                  className={classes.name}
                  name="newTableName"
                  size="small"
                  onClick={(event: Event) => event.stopPropagation()}
                  fullWidth
                  initialValue={tabulatorTable.name}
                  errors={{
                    required: 'Enter a table name',
                  }}
                  helperText={<InlineError keys={['name']} />}
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
                    setEditName(false)
                  }}
                  color="primary"
                  disabled={disabled}
                >
                  Cancel
                </M.Button>
                <RF.Field component="input" type="hidden" name="name" />
              </form>
            )}
          </RF.Form>
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
                setEditName(true)
              }}
              disabled={disabled}
            >
              Rename
            </M.MenuItem>
            <M.MenuItem
              onClick={() => {
                setAnchorEl(null)
                confirm.open()
              }}
              disabled={disabled}
            >
              Delete
            </M.MenuItem>
          </M.Menu>
        </M.ListItemSecondaryAction>
      </M.ListItem>
      <M.Collapse in={open || !!deleteError.config}>
        <M.ListItem disabled={editName}>
          <RF.Form
            initialValues={tabulatorTable}
            onSubmit={(values) => onSubmit({ ...tabulatorTable, ...values })}
          >
            {({ handleSubmit, submitFailed }) => (
              <form onSubmit={handleSubmit} className={classes.config}>
                <OnDirty.Spy onChange={onFormSpy} />
                <RF.Field
                  className={classes.editor}
                  component={YamlEditorField}
                  errors={{
                    required: 'Enter config content',
                    invalid: 'YAML is invalid',
                  }}
                  name="config"
                  validate={validators.composeAnd(
                    validators.required as FF.FieldValidator<string>,
                    validateYaml,
                    validateTable,
                  )}
                  disabled={disabled}
                />
                <div className={classes.formBottom}>
                  {submitFailed && <InlineError keys={['name']} />}
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
        </M.ListItem>
        <M.Divider />
      </M.Collapse>
    </>
  )
}

function parseResponseError(
  r: Exclude<Model.GQLTypes.BucketSetTabulatorTableResult, Model.GQLTypes.BucketConfig>,
): FF.SubmissionErrors | undefined {
  switch (r.__typename) {
    case 'InvalidInput':
      return mapInputErrors(r.errors, {
        config: 'config',
        newTableName: 'newTableName',
        tableName: 'newTableName',
      })
    case 'OperationError':
      return mkFormError(r.message)
    default:
      return assertNever(r)
  }
}

const useStyles = M.makeStyles((t) => ({
  empty: {
    paddingBottom: t.spacing(2),
  },
  textPlaceholder: {
    height: t.spacing(3),
  },
}))

interface TabulatorProps {
  bucket: string
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

/** Have to be suspended because of `<TextEditor />` */
export default function Tabulator({
  bucket: bucketName,
  tabulatorTables,
}: TabulatorProps) {
  loadMode('yaml')

  const renameTabulatorTable = GQL.useMutation(RENAME_TABULATOR_TABLE_MUTATION)
  const setTabulatorTable = GQL.useMutation(SET_TABULATOR_TABLE_MUTATION)
  const { push: notify } = Notifications.use()

  const [toAdd, setToAdd] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const onDelete = React.useCallback(
    async ({
      name: tableName,
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
        return parseResponseError(r)
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
      const { name: tableName, newTableName } = values
      try {
        setSubmitting(true)
        const response = await renameTabulatorTable({
          bucketName,
          tableName,
          newTableName,
        })
        const r = response.admin
          .bucketRenameTabulatorTable as Model.GQLTypes.BucketSetTabulatorTableResult
        setSubmitting(false)
        if (r.__typename === 'BucketConfig') {
          notify(`Successfully updated ${tableName} table`)
          return undefined
        }
        return parseResponseError(r)
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
    async ({
      name: tableName,
      config,
    }: FormValuesSetTable): Promise<FF.SubmissionErrors | undefined> => {
      try {
        setSubmitting(true)
        const response = await setTabulatorTable({ bucketName, tableName, config })
        const r = response.admin
          .bucketSetTabulatorTable as Model.GQLTypes.BucketSetTabulatorTableResult
        setSubmitting(false)
        if (r.__typename === 'BucketConfig') {
          notify(`Successfully created ${tableName} table`)
          return undefined
        }
        return parseResponseError(r)
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
        setToAdd(false)
      }
      return error
    },
    [onSubmit],
  )

  const classes = useStyles()

  if (!tabulatorTables.length && !toAdd) {
    return <Empty className={classes.empty} onClick={() => setToAdd(true)} />
  }
  return (
    <>
      <M.List>
        {tabulatorTables.map((tabulatorTable) => (
          <TabulatorRow
            key={tabulatorTable.name}
            disabled={submitting}
            onDelete={onDelete}
            onRename={onRename}
            onSubmit={onSubmit}
            tabulatorTable={tabulatorTable}
          />
        ))}
      </M.List>
      <M.Divider />
      <M.List>
        <M.ListItem>
          {toAdd ? (
            <AddTable
              disabled={submitting}
              onCancel={() => setToAdd(false)}
              onSubmit={onSubmitNew}
            />
          ) : (
            <>
              <M.ListItemText primary={<div className={classes.textPlaceholder}></div>} />
              <M.ListItemSecondaryAction>
                <M.Button
                  disabled={submitting}
                  onClick={() => setToAdd(true)}
                  type="button"
                >
                  Add table
                </M.Button>
              </M.ListItemSecondaryAction>
            </>
          )}
        </M.ListItem>
      </M.List>
    </>
  )
}
