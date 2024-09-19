import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import federatorConfigSchema from 'schemas/federatorConfig.yml.json'

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

import SET_TABULATOR_TABLE_MUTATION from './gql/TabulatorTablesAdd.generated'

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

const validateConfig: FF.FieldValidator<string> = (inputStr?: string) => {
  const data = yaml.parse(inputStr)
  const validator = makeSchemaValidator(federatorConfigSchema)
  const errors = validator(data)
  if (errors.length) {
    return new JsonInvalidAgainstSchema({ errors }).message
  }
  return undefined
}

const useLongQueryConfigFormStyles = M.makeStyles((t) => ({
  delete: {
    color: t.palette.error.main,
    marginBottom: 'auto',
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
  editor: {
    height: t.spacing(25),
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: t.spacing(1),
  },
  name: {
    flexGrow: 1,
    marginTop: t.spacing(2),
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
      marginTop: t.spacing(1),
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

interface LongQueryConfigFormProps {
  bucketName: string
  className: string
  onDirty: (dirty: boolean) => void
}

interface AddFirst extends LongQueryConfigFormProps {
  onClose?: never // Don't close if no other configs
  tabulatorTable?: never // We create new config, so we don't have one
}

interface AddNew extends LongQueryConfigFormProps {
  onClose: () => void
  tabulatorTable?: never // We create new config, so we don't have one
}

interface EditExisting extends LongQueryConfigFormProps {
  onClose?: never // Don't close editing config
  tabulatorTable: FormValues
}

function LongQueryConfigForm({
  bucketName,
  className,
  tabulatorTable,
  onClose,
  onDirty,
}: AddFirst | AddNew | EditExisting) {
  const setTabulatorTable = GQL.useMutation(SET_TABULATOR_TABLE_MUTATION)
  const classes = useLongQueryConfigFormStyles()

  const { push: notify } = Notifications.use()

  const submitConfig = React.useCallback(
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
            notify(`Successfully updated ${tableName} config`)
            if (onClose) {
              onClose()
            }
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
        console.error('Error updating SSO config')
        // eslint-disable-next-line no-console
        console.error(e)
        return mkFormError('unexpected')
      }
    },
    [bucketName, notify, onClose, setTabulatorTable],
  )

  const onSubmit = React.useCallback(
    async (values: FormValues, form: FF.FormApi<FormValues, FormValues>) => {
      const result = await submitConfig(values.name, values.config)
      form.reset(values)
      return result
    },
    [submitConfig],
  )
  const [deleting, setDeleting] = React.useState<
    FF.SubmissionErrors | boolean | undefined
  >()
  const deleteExistingConfig = React.useCallback(async () => {
    if (!tabulatorTable) {
      // Should have called onClose instead
      throw new Error('No tabulator Table to delete')
    }
    setDeleting(true)
    const errors = await submitConfig(tabulatorTable.name)
    setDeleting(errors)
  }, [submitConfig, tabulatorTable])

  const confirm = useConfirm({
    title: tabulatorTable
      ? `You are about to delete "${tabulatorTable.name}" longitudinal query config`
      : 'You have unsaved changes. Delete anyway?',
    submitTitle: 'Delete',
    onSubmit: React.useCallback(
      (confirmed) => {
        if (!confirmed) return
        if (tabulatorTable) deleteExistingConfig()
        if (onClose) onClose()
      },
      [tabulatorTable, deleteExistingConfig, onClose],
    ),
  })
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
          {confirm.render(<></>)}
          <RF.FormSpy
            subscription={{ dirty: true }}
            onChange={({ dirty }) => onDirty(dirty)}
          />
          <div className={classes.main}>
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
                validateConfig,
              )}
              disabled={submitting || deleting}
            />
            <RF.Field
              className={classes.name}
              component={Form.Field}
              errors={{
                required: 'Enter a config name',
              }}
              fullWidth
              label="Config name"
              name="name"
              validate={validators.required as FF.FieldValidator<any>}
              variant="outlined"
              size="small"
              disabled={!!tabulatorTable || submitting || deleting}
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
              disabled={submitting || deleting === true || (!tabulatorTable && !onClose)}
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

const useConfigsStyles = M.makeStyles((t) => ({
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
  title: {
    marginBottom: t.spacing(3),
  },
  actions: {
    margin: t.spacing(2, -5, 0),
    display: 'flex',
    justifyContent: 'flex-end',
    padding: t.spacing(2, 0, 0),
  },
  button: {
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
}))

interface ConfigsProps {
  bucket: string
  tabulatorTables: Model.GQLTypes.BucketConfig['tabulatorTables']
  onClose: () => void
  onDirty: (dirty: boolean) => void
}

export default function Configs({
  bucket,
  onClose,
  onDirty,
  tabulatorTables,
}: ConfigsProps) {
  const classes = useConfigsStyles()
  loadMode('yaml')
  const [toAdd, setToAdd] = React.useState(tabulatorTables.length === 0)
  const [dirty, setDirty] = React.useState(0)
  const confirm = useConfirm({
    title: 'You have unsaved changes. Close anyway?',
    submitTitle: 'Discard changes and close',
    onSubmit: (confirmed) => confirmed && onClose(),
  })
  const handleDirty = React.useCallback(
    (formDirty) => {
      const dirtyCounter = formDirty ? dirty + 1 : Math.max(dirty - 1, 0)
      setDirty(dirtyCounter)
      onDirty(!!dirtyCounter)
    },
    [dirty, onDirty],
  )
  return (
    <>
      {tabulatorTables.map((tabulatorTable) => (
        <LongQueryConfigForm
          bucketName={bucket}
          className={classes.item}
          key={tabulatorTable.name}
          tabulatorTable={tabulatorTable}
          onDirty={handleDirty}
        />
      ))}
      {toAdd &&
        (tabulatorTables.length ? (
          <LongQueryConfigForm
            bucketName={bucket}
            className={classes.item}
            key="new-config"
            onClose={() => setToAdd(false)}
            onDirty={handleDirty}
          />
        ) : (
          <LongQueryConfigForm
            bucketName={bucket}
            className={classes.item}
            key="first-config"
            onDirty={handleDirty}
          />
        ))}
      <div className={classes.actions}>
        <M.Button type="button" onClick={confirm.open} className={classes.button}>
          Close
        </M.Button>
        <M.Button
          type="button"
          className={classes.button}
          onClick={() => setToAdd(true)}
          startIcon={<M.Icon>post_add</M.Icon>}
          disabled={toAdd}
        >
          Add config
        </M.Button>
      </div>
    </>
  )
}
