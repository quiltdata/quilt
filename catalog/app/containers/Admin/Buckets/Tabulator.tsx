import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

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
// import RENAME_TABULATOR_TABLE_MUTATION from './gql/TabulatorTablesRename.generated'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

type YamlEditorFieldProps = RF.FieldRenderProps<string> &
  M.TextFieldProps & { className: string }

function YamlEditorField({
  className,
  disabled,
  errors,
  input,
  meta,
}: YamlEditorFieldProps) {
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined

  const [key, setKey] = React.useState(0)
  const reset = React.useCallback(() => setKey((k) => k + 1), [])
  React.useEffect(() => {
    if (meta.pristine) reset()
  }, [meta.pristine, reset])

  return (
    <TextEditor
      className={className}
      disabled={disabled}
      error={errorMessage ? new Error(errorMessage) : null}
      key={key}
      leadingChange={false}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
      initialValue={meta.initial}
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

const useTabulatorTableStyles = M.makeStyles((t) => ({
  delete: {
    color: t.palette.error.main,
    marginBottom: 'auto',
  },
  editor: {
    minHeight: t.spacing(25),
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(1),
  },
  name: {
    marginBottom: t.spacing(2),
  },
  root: {
    alignItems: 'stretch',
    display: 'flex',
  },
  main: {
    flexGrow: 1,
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    marginLeft: t.spacing(2),
  },
  button: {
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
  lock: {
    alignItems: 'center',
    animation: '$showLock .3s ease-out',
    background: fade(t.palette.background.paper, 0.7),
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  '@keyframes showLock': {
    '0%': {
      transform: 'scale(1.2x)',
    },
    '100%': {
      transform: 'scale(1)',
    },
  },
}))

type FormValues = Pick<Model.GQLTypes.TabulatorTable, 'name' | 'config'>

interface TabulatorTableProps {
  bucketName: string
  className: string
  onEdited?: () => void
}

interface AddNew extends TabulatorTableProps {
  onClose: () => void
  tabulatorTable?: never // We create new table, so we don't have one
}

interface EditExisting extends TabulatorTableProps {
  onClose?: never // Don't close editing table
  tabulatorTable: FormValues
}

function TabulatorTable({
  bucketName,
  className,
  onClose,
  onEdited,
  tabulatorTable,
}: AddNew | EditExisting) {
  const setTabulatorTable = GQL.useMutation(SET_TABULATOR_TABLE_MUTATION)
  const classes = useTabulatorTableStyles()

  const { push: notify } = Notifications.use()

  const submitTable = React.useCallback(
    async (
      tableName: string,
      config: string | null = null,
    ): Promise<FF.SubmissionErrors | boolean | undefined> => {
      try {
        const {
          admin: { bucketSetTabulatorTable: r },
        } = await setTabulatorTable({ bucketName, tableName, config })
        switch (r.__typename) {
          case 'BucketConfig':
            notify(`Successfully updated ${tableName} table`)
            return undefined
          case 'InvalidInput':
            return mapInputErrors(r.errors)
          case 'OperationError':
            return mkFormError(r.message)
          default:
            return assertNever(r)
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error updating tabulator table')
        // eslint-disable-next-line no-console
        console.error(e)
        return mkFormError('unexpected')
      }
    },
    [bucketName, notify, setTabulatorTable],
  )

  const onSubmit = React.useCallback(
    async (values: FormValues, form: FF.FormApi<FormValues, FormValues>) => {
      const result = await submitTable(values.name, values.config)
      if (!result) {
        form.reset(values)
        if (onEdited) {
          onEdited()
        }
      }
      return result
    },
    [onEdited, submitTable],
  )
  const [deleting, setDeleting] = React.useState<
    FF.SubmissionErrors | boolean | undefined
  >()
  const deleteExistingTable = React.useCallback(async () => {
    if (!tabulatorTable) {
      // Should have called onClose instead
      throw new Error('No tabulator Table to delete')
    }
    setDeleting(true)
    const errors = await submitTable(tabulatorTable.name)
    setDeleting(errors)
    if (onEdited && !errors) {
      onEdited()
    }
  }, [onEdited, submitTable, tabulatorTable])

  const confirm = useConfirm({
    title: tabulatorTable
      ? `You are about to delete "${tabulatorTable.name}" table`
      : 'You have unsaved changes. Delete anyway?',
    submitTitle: 'Delete',
    onSubmit: React.useCallback(
      (confirmed) => {
        if (!confirmed) return
        if (tabulatorTable) deleteExistingTable()
        if (onClose) onClose()
      },
      [tabulatorTable, deleteExistingTable, onClose],
    ),
  })
  const { onChange: onFormSpy } = OnDirty.use()
  return (
    <RF.Form onSubmit={onSubmit} initialValues={tabulatorTable}>
      {({
        form,
        pristine,
        handleSubmit,
        submitting,
        submitFailed,
        hasValidationErrors,
        error,
        submitError,
      }) => (
        <form className={cx(classes.root, className)} onSubmit={handleSubmit}>
          <OnDirty.Spy onChange={onFormSpy} />
          {confirm.render(<></>)}
          <div className={classes.main}>
            <RF.Field
              className={classes.name}
              component={Form.Field}
              errors={{
                required: 'Enter a table name',
              }}
              fullWidth
              label="Table name"
              name="name"
              validate={validators.required as FF.FieldValidator<any>}
              variant="outlined"
              size="small"
              disabled={!!tabulatorTable || submitting || deleting}
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
                validators.required as FF.FieldValidator<any>,
                validateYaml,
                validateTable,
              )}
              disabled={submitting || deleting}
            />
            {(submitFailed || typeof deleting === 'object') && (
              <Form.FormError
                error={
                  error ||
                  submitError ||
                  (typeof deleting === 'object' && deleting[FF.FORM_ERROR])
                }
                errors={{ unexpected: 'Something went wrong' }}
              />
            )}
            {(submitting || deleting) && (
              <div className={classes.lock}>
                <M.CircularProgress size={24} />
              </div>
            )}
          </div>
          <div className={classes.actions}>
            <M.Button
              onClick={onClose && pristine ? onClose : confirm.open}
              type="button"
              className={cx(classes.delete, classes.button)}
              disabled={submitting || deleting === true}
              variant="outlined"
            >
              Delete
            </M.Button>
            <M.Button
              onClick={() => form.reset()}
              className={classes.button}
              color="primary"
              disabled={pristine || submitting || deleting === true}
              variant="outlined"
            >
              Reset
            </M.Button>
            <M.Button
              className={classes.button}
              onClick={form.submit}
              color="primary"
              disabled={
                pristine ||
                submitting ||
                deleting === true ||
                (submitFailed && hasValidationErrors)
              }
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

const useEmptyStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
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
        No tabulator tables configured
      </M.Typography>
      <M.Button variant="contained" color="primary" size="small" onClick={onClick}>
        Create table
      </M.Button>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0, 0),
    display: 'flex',
    justifyContent: 'flex-end',
    padding: t.spacing(2, 0, 0),
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  empty: {
    paddingBottom: t.spacing(2),
  },
  item: {
    position: 'relative',
    '& + &': {
      marginTop: t.spacing(3),
      paddingTop: t.spacing(3),
      '&::before': {
        background: t.palette.divider,
        content: '""',
        height: '1px',
        left: t.spacing(2),
        position: 'absolute',
        right: t.spacing(2),
        top: 0,
      },
    },
  },
}))

interface TabulatorProps {
  bucket: string
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
}

/** Have to be suspended because of `<TextEditor />` */
export default function Tabulator({ bucket, tabulatorTables }: TabulatorProps) {
  const classes = useStyles()
  loadMode('yaml')
  const [toAdd, setToAdd] = React.useState(false)
  if (!tabulatorTables.length && !toAdd) {
    return <Empty className={classes.empty} onClick={() => setToAdd(true)} />
  }
  return (
    <>
      {tabulatorTables.map((tabulatorTable) => (
        <TabulatorTable
          key={tabulatorTable.name}
          bucketName={bucket}
          className={classes.item}
          tabulatorTable={tabulatorTable}
        />
      ))}
      {toAdd && (
        <TabulatorTable
          bucketName={bucket}
          className={classes.item}
          onClose={() => setToAdd(false)}
          onEdited={() => setToAdd(false)}
        />
      )}
      <div className={classes.actions}>
        <M.Button
          className={classes.button}
          disabled={toAdd}
          onClick={() => setToAdd(true)}
          startIcon={<M.Icon>post_add</M.Icon>}
          type="button"
        >
          Add table
        </M.Button>
      </div>
    </>
  )
}
