import * as FF from 'final-form'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import * as Form from 'components/Form'
import type { ToolbarProps as ToolbarWrapperProps } from 'components/JsonEditor/Toolbar'
import * as JSONPointer from 'utils/JSONPointer'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import { useRoute } from 'utils/router'
import type { JsonRecord } from 'utils/types'
import * as validators from 'utils/validators'
import type { WorkflowYaml } from 'utils/workflows'

interface FieldProps {
  bucket: string
  errors: Record<string, React.ReactNode>
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
}

function SchemaField({
  bucket,
  input,
  meta,
  errors,
  helperText,
  InputLabelProps,
  ...rest
}: FieldProps & M.TextFieldProps) {
  const { urls } = NamedRoutes.use()
  const href = React.useMemo(
    () =>
      input.value
        ? urls.bucketFile(bucket, `.quilt/workflows/${input.value}.json`, { edit: true })
        : null,
    [urls, bucket, input.value],
  )
  const error = meta.submitFailed && (meta.error || meta.submitError)
  const props = {
    error: !!error,
    helperText: error ? errors[error] || error : helperText,
    disabled: meta.submitting || meta.submitSucceeded,
    InputLabelProps: { shrink: true, ...InputLabelProps },
    InputProps: {
      endAdornment: href && (
        <a href={href} target="_blank">
          <M.IconButton size="small">
            <M.Icon>open_in_new</M.Icon>
          </M.IconButton>
        </a>
      ),
    },
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

function validateSchemaName() {
  return undefined
}

const useButtonStyles = M.makeStyles({
  root: {
    padding: 0,
  },
})

interface ButtonProps {
  onClick: () => void
}

function Button({ onClick }: ButtonProps) {
  const classes = useButtonStyles()
  return (
    <M.IconButton className={classes.root} onClick={onClick} size="small">
      <M.Icon>add_circle_outline</M.Icon>
    </M.IconButton>
  )
}

interface FormErrorProps {
  error: Error
}

function FormError({ error }: FormErrorProps) {
  return (
    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
      <M.Icon color="error">error_outline</M.Icon>
      <M.Box pl={1} />
      <M.Typography variant="body2" color="error">
        {error}
      </M.Typography>
    </M.Box>
  )
}

const FormControlProps = { margin: 'normal', size: 'small' }

const emptyObject = {}

type FormValues = WorkflowYaml

interface PopupProps {
  bucket: string
  open: boolean
  onClose: () => void
  onSubmit: (value: FormValues) => void
}

function Popup({ bucket, open, onClose, onSubmit }: PopupProps) {
  return (
    <M.Dialog onClose={onClose} open={open} fullWidth maxWidth="sm">
      <RF.Form onSubmit={onSubmit}>
        {({
          handleSubmit,
          submitting,
          submitFailed,
          submitError,
          error,
          hasValidationErrors,
        }) => (
          <>
            <M.DialogTitle>Add workflow</M.DialogTitle>
            <M.DialogContent>
              <RF.Field
                component={Form.Field}
                errors={{
                  required: 'Enter workflow name',
                }}
                disabled={submitting}
                fullWidth
                label="Workflow name"
                margin="normal"
                name="name"
                placeholder="e.g. Workflow A"
                size="small"
                validate={validators.required as FF.FieldValidator<string>}
              />
              <RF.Field
                component={Form.Field}
                disabled={submitting}
                errors={emptyObject}
                fullWidth
                label="Workflow description"
                margin="normal"
                name="description"
                placeholder="e.g. Highly useful workflow"
                size="small"
              />
              <RF.Field
                component={Form.Field}
                disabled={submitting}
                errors={emptyObject}
                fullWidth
                label="package_handle, Regular expression to validate package handle"
                margin="normal"
                name="handle_pattern"
                placeholder="e.g. ^foo/bar$"
                size="small"
              />
              <RF.Field
                bucket={bucket}
                component={SchemaField}
                disabled={submitting}
                errors={emptyObject}
                fullWidth
                label="Metadata JSON Schema name"
                margin="normal"
                name="metadata_schema"
                placeholder="e.g. mySchema1"
                size="small"
                validate={validateSchemaName}
              />
              <RF.Field
                bucket={bucket}
                component={SchemaField}
                disabled={submitting}
                errors={emptyObject}
                fullWidth
                label="Entries JSON Schema name"
                margin="normal"
                name="entries_schema"
                placeholder="e.g. mySchema1"
                size="small"
                validate={validateSchemaName}
              />
              <RF.Field
                FormControlProps={FormControlProps}
                component={Form.Checkbox}
                type="checkbox"
                name="is_message_required"
                label="Is message required"
              />
            </M.DialogContent>
            <M.DialogActions>
              {(!!error || !!submitError) && <FormError error={error || submitError} />}
              <M.Button onClick={onClose} disabled={submitting}>
                Cancel
              </M.Button>
              <M.Button
                type="submit"
                onClick={handleSubmit}
                variant="contained"
                color="primary"
                disabled={submitting || (submitFailed && hasValidationErrors)}
              >
                Save
              </M.Button>
            </M.DialogActions>
          </>
        )}
      </RF.Form>
    </M.Dialog>
  )
}

interface ToolbarProps {
  bucket: string
  onChange: (value: WorkflowYaml) => void
}

function Toolbar({ bucket, onChange }: ToolbarProps) {
  const [open, setOpen] = React.useState(false)
  const handleSubmit = React.useCallback(
    (value: FormValues) => {
      onChange(value)
      setOpen(false)
    },
    [onChange],
  )

  return (
    <>
      <Button onClick={() => setOpen(true)} />
      <Popup
        bucket={bucket || 'fiskus-sandbox-dev'}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  )
}

function addSchema(schemaName: string) {
  return R.assocPath(['schemas', schemaName], {
    url: `s3://.quilt/workflows/${schemaName}.json`,
  })
}

function addMetadataSchema({
  metadata_schema,
}: WorkflowYaml): (j: JsonRecord) => JsonRecord {
  return R.ifElse(
    () => !!metadata_schema,
    addSchema(metadata_schema as string),
    R.identity,
  )
}

function addEntriesSchema({
  entries_schema,
}: WorkflowYaml): (j: JsonRecord) => JsonRecord {
  return R.ifElse(() => !!entries_schema, addSchema(entries_schema as string), R.identity)
}

function addWorkflow(workflow: WorkflowYaml): (j: JsonRecord) => JsonRecord {
  const workflowName = workflow.name.replace(' ', '_')
  return R.assocPath(['workflows', workflowName], workflow)
}

export default function ToolbarWrapper({ columnPath, onChange }: ToolbarWrapperProps) {
  const { paths } = NamedRoutes.use()
  const { match } = useRoute(paths.bucketFile, { exact: true })

  const handleChange = React.useCallback(
    (workflow: WorkflowYaml) => {
      onChange((j: JsonRecord) =>
        FP.function.pipe(
          j,
          addMetadataSchema(workflow),
          addEntriesSchema(workflow),
          addWorkflow(workflow),
        ),
      )
    },
    [onChange],
  )

  const bucket = match?.params?.bucket
  if (!bucket) return null

  const pointer = JSONPointer.stringify(columnPath)
  switch (pointer) {
    case '/workflows':
      return <Toolbar bucket={bucket} onChange={handleChange} />
    default:
      return null
  }
}
