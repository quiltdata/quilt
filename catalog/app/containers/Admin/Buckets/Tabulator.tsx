import cx from 'classnames'
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
// import { fade } from '@material-ui/core/styles'

import tabulatorTableSchema from 'schemas/tabulatorTable.yml.json'

// import { useConfirm } from 'components/Dialog'
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

// import * as OnDirty from './OnDirty'

import SET_TABULATOR_TABLE_MUTATION from './gql/TabulatorTablesSet.generated'
import RENAME_TABULATOR_TABLE_MUTATION from './gql/TabulatorTablesRename.generated'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

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

// const useTabulatorTableStyles = M.makeStyles((t) => ({
//   delete: {
//     color: t.palette.error.main,
//     marginBottom: 'auto',
//   },
//   editor: {
//     minHeight: t.spacing(15),
//     '& .ace_editor': {
//       minHeight: t.spacing(15),
//     },
//   },
//   header: {
//     alignItems: 'center',
//     display: 'flex',
//     marginBottom: t.spacing(1),
//   },
//   name: {
//     marginBottom: t.spacing(2),
//   },
//   root: {
//     alignItems: 'stretch',
//     display: 'flex',
//   },
//   main: {
//     flexGrow: 1,
//   },
//   actions: {
//     display: 'flex',
//     flexDirection: 'column',
//     flexShrink: 0,
//     marginLeft: t.spacing(2),
//   },
//   button: {
//     '& + &': {
//       marginTop: t.spacing(2),
//     },
//   },
//   lock: {
//     alignItems: 'center',
//     animation: '$showLock .3s ease-out',
//     background: fade(t.palette.background.paper, 0.7),
//     bottom: 0,
//     display: 'flex',
//     justifyContent: 'center',
//     left: 0,
//     position: 'absolute',
//     right: 0,
//     top: 0,
//     zIndex: 10,
//   },
//   '@keyframes showLock': {
//     '0%': {
//       transform: 'scale(1.2x)',
//     },
//     '100%': {
//       transform: 'scale(1)',
//     },
//   },
// }))

// type FormValues = Pick<Model.GQLTypes.TabulatorTable, 'name' | 'config'>

// interface TabulatorTableProps {
//   bucketName: string
//   className: string
// }

// interface AddNew extends TabulatorTableProps {
//   onClose: () => void
//   tabulatorTable?: never // We create new table, so we don't have one
// }
//
// interface EditExisting extends TabulatorTableProps {
//   onClose?: never // Don't close editing table
//   tabulatorTable: FormValues
// }

// function TabulatorTable({
//   bucketName,
//   className,
//   onClose,
//   tabulatorTable,
// }: AddNew | EditExisting) {
//   const renameTabulatorTable = GQL.useMutation(RENAME_TABULATOR_TABLE_MUTATION)
//   const setTabulatorTable = GQL.useMutation(SET_TABULATOR_TABLE_MUTATION)
//   const classes = useTabulatorTableStyles()
//
//   const { push: notify } = Notifications.use()
//
//   const renameTable = React.useCallback(
//     async (
//       tableName: string,
//       newTableName: string,
//     ): Promise<FF.SubmissionErrors | boolean | undefined> => {
//       try {
//         const {
//           admin: { bucketRenameTabulatorTable: r },
//         } = await renameTabulatorTable({ bucketName, tableName, newTableName })
//         switch (r.__typename) {
//           case 'BucketConfig':
//             notify(`Successfully updated ${tableName} table`)
//             return undefined
//           case 'InvalidInput':
//             return mapInputErrors(r.errors)
//           case 'OperationError':
//             return mkFormError(r.message)
//           default:
//             return assertNever(r)
//         }
//       } catch (e) {
//         // eslint-disable-next-line no-console
//         console.error('Error updating tabulator table')
//         // eslint-disable-next-line no-console
//         console.error(e)
//         return mkFormError('unexpected')
//       }
//     },
//     [bucketName, notify, renameTabulatorTable],
//   )
//
//   const setTable = React.useCallback(
//     async (
//       tableName: string,
//       config: string | null = null,
//     ): Promise<FF.SubmissionErrors | boolean | undefined> => {
//       try {
//         const {
//           admin: { bucketSetTabulatorTable: r },
//         } = await setTabulatorTable({ bucketName, tableName, config })
//         switch (r.__typename) {
//           case 'BucketConfig':
//             notify(`Successfully updated ${tableName} table`)
//             return undefined
//           case 'InvalidInput':
//             return mapInputErrors(r.errors)
//           case 'OperationError':
//             return mkFormError(r.message)
//           default:
//             return assertNever(r)
//         }
//       } catch (e) {
//         // eslint-disable-next-line no-console
//         console.error('Error updating tabulator table')
//         // eslint-disable-next-line no-console
//         console.error(e)
//         return mkFormError('unexpected')
//       }
//     },
//     [bucketName, notify, setTabulatorTable],
//   )
//
//   const onSubmit = React.useCallback(
//     async (values: FormValues, form: FF.FormApi<FormValues, FormValues>) => {
//       // Rename
//       // if theres is a table to rename
//       // and the name was changed
//       if (tabulatorTable && values.name !== tabulatorTable.name) {
//         const renameResult = await renameTable(tabulatorTable.name, values.name)
//         if (renameResult) {
//           return renameResult
//         }
//       }
//
//       // Create table if no one,
//       // or update the config if it was changed
//       // NOTE: table name could be new, just updated above
//       if (!tabulatorTable || values.config !== tabulatorTable.config) {
//         const result = await setTable(values.name, values.config)
//         if (result) {
//           return result
//         }
//       }
//
//       form.reset(values)
//       if (onClose) {
//         onClose()
//       }
//     },
//     [onClose, renameTable, setTable, tabulatorTable],
//   )
//   const [deleting, setDeleting] = React.useState<
//     FF.SubmissionErrors | boolean | undefined
//   >()
//   const deleteExistingTable = React.useCallback(async () => {
//     if (!tabulatorTable) {
//       // Should have called onClose instead
//       throw new Error('No tables to delete')
//     }
//     setDeleting(true)
//     const errors = await setTable(tabulatorTable.name)
//     setDeleting(errors)
//   }, [setTable, tabulatorTable])
//
//   const confirm = useConfirm({
//     title: tabulatorTable
//       ? `You are about to delete "${tabulatorTable.name}" table`
//       : 'You have unsaved changes. Delete anyway?',
//     submitTitle: 'Delete',
//     onSubmit: React.useCallback(
//       (confirmed) => {
//         if (!confirmed) return
//         if (tabulatorTable) deleteExistingTable()
//         if (onClose) onClose()
//       },
//       [tabulatorTable, deleteExistingTable, onClose],
//     ),
//   })
//   const { onChange: onFormSpy } = OnDirty.use()
//   return (
//     <RF.Form onSubmit={onSubmit} initialValues={tabulatorTable}>
//       {({
//         form,
//         pristine,
//         handleSubmit,
//         submitting,
//         submitFailed,
//         hasValidationErrors,
//         error,
//         submitError,
//       }) => (
//         <form className={cx(classes.root, className)} onSubmit={handleSubmit}>
//           <OnDirty.Spy onChange={onFormSpy} />
//           {confirm.render(<></>)}
//           <div className={classes.main}>
//             <RF.Field
//               className={classes.name}
//               component={Form.Field}
//               errors={{
//                 required: 'Enter a table name',
//               }}
//               fullWidth
//               label="Table name"
//               name="name"
//               validate={validators.required as FF.FieldValidator<any>}
//               variant="outlined"
//               size="small"
//               disabled={submitting || deleting}
//             />
//             <RF.Field
//               className={classes.editor}
//               component={YamlEditorField}
//               errors={{
//                 required: 'Enter config content',
//                 invalid: 'YAML is invalid',
//               }}
//               name="config"
//               validate={validators.composeAnd(
//                 validators.required as FF.FieldValidator<any>,
//                 validateYaml,
//                 validateTable,
//               )}
//               disabled={submitting || deleting}
//               autoFocus={!tabulatorTable}
//             />
//             {(submitFailed || typeof deleting === 'object') && (
//               <Form.FormError
//                 error={
//                   error ||
//                   submitError ||
//                   (typeof deleting === 'object' && deleting[FF.FORM_ERROR])
//                 }
//                 errors={{ unexpected: 'Something went wrong' }}
//               />
//             )}
//             {(submitting || deleting) && (
//               <div className={classes.lock}>
//                 <M.CircularProgress size={24} />
//               </div>
//             )}
//           </div>
//           <div className={classes.actions}>
//             <M.Button
//               onClick={onClose && pristine ? onClose : confirm.open}
//               type="button"
//               className={cx(classes.delete, classes.button)}
//               disabled={submitting || deleting === true}
//               variant="outlined"
//             >
//               Delete
//             </M.Button>
//             <M.Button
//               onClick={() => form.reset()}
//               className={classes.button}
//               color="primary"
//               disabled={pristine || submitting || deleting === true}
//               variant="outlined"
//             >
//               Reset
//             </M.Button>
//             <M.Button
//               className={classes.button}
//               onClick={form.submit}
//               color="primary"
//               disabled={
//                 pristine ||
//                 submitting ||
//                 deleting === true ||
//                 (submitFailed && hasValidationErrors)
//               }
//               variant="contained"
//             >
//               Save
//             </M.Button>
//           </div>
//         </form>
//       )}
//     </RF.Form>
//   )
// }

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
  return (
    <RF.Form onSubmit={onSubmit}>
      {({ handleSubmit, error, submitError, submitFailed }) => (
        <form onSubmit={handleSubmit} className={classes.root}>
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
            validate={validators.required as FF.FieldValidator<any>}
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
              validators.required as FF.FieldValidator<any>,
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

  return (
    <>
      <M.ListItem button onClick={() => setOpen((x) => !x)} disabled={disabled}>
        <M.ListItemIcon>
          <M.Icon>{open ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}</M.Icon>
        </M.ListItemIcon>
        {editName && isEmpty(deleteError) ? (
          <RF.Form initialValues={tabulatorTable} onSubmit={onRename}>
            {({ handleSubmit, error, submitError, errors, submitErrors }) => (
              <form onSubmit={handleSubmit} className={classes.nameForm}>
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
                  helperText={
                    <Form.FormError
                      /* @ts-expect-error */
                      component="span"
                      errors={{}}
                      error={error || submitError || errors?.name || submitErrors?.name}
                      margin="none"
                    />
                  }
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
                handleDelete()
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
            {({
              handleSubmit,
              error,
              errors,
              submitErrors,
              submitError,
              submitFailed,
            }) => (
              <form onSubmit={handleSubmit} className={classes.config}>
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
                  disabled={disabled}
                />
                <div className={classes.formBottom}>
                  {submitFailed && (
                    <Form.FormError
                      errors={{}}
                      error={error || submitError || errors?.name || submitErrors?.name}
                      margin="none"
                    />
                  )}
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
