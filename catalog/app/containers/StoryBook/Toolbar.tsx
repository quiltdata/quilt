import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import type { ToolbarProps } from 'components/JsonEditor/Toolbar'
import * as Form from 'containers/Admin/Form'
import * as JSONPointer from 'utils/JSONPointer'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import * as validators from 'utils/validators'

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

const InputLabelProps = { shrink: true }

const emptyObject = {}

interface FormValues {
  name: string
}

interface PopupProps {
  bucket: string
  open: boolean
  onClose: () => void
}

function Popup({ bucket, onClose, open }: PopupProps) {
  const onSubmit = React.useCallback((values: FormValues) => {
    // eslint-disable-next-line no-console
    console.log(values)
  }, [])
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
                name="name"
                label="Workflow name"
                placeholder="e.g. Workflow A"
                validate={validators.required as FF.FieldValidator<string>}
                errors={{
                  required: 'Enter workflow name',
                }}
                disabled={submitting}
                fullWidth
                InputLabelProps={InputLabelProps}
              />
              <RF.Field
                component={Form.Field}
                name="description"
                label="Workflow description"
                errors={emptyObject}
                disabled={submitting}
                fullWidth
                InputLabelProps={InputLabelProps}
              />
              <RF.Field
                component={Form.Field}
                name="handle_pattern"
                label="package_handle, Regular expression to validate package handle"
                errors={emptyObject}
                disabled={submitting}
                fullWidth
                InputLabelProps={InputLabelProps}
              />
              <RF.Field
                bucket={bucket}
                component={SchemaField}
                name="metadata_schema"
                label="Metadata JSON Schema name"
                placeholder="mySchema1"
                validate={validateSchemaName}
                errors={emptyObject}
                disabled={submitting}
                fullWidth
                InputLabelProps={InputLabelProps}
              />
              <RF.Field
                bucket={bucket}
                component={SchemaField}
                name="entries_schema"
                label="Entries JSON Schema name"
                placeholder="mySchema1"
                validate={validateSchemaName}
                errors={emptyObject}
                disabled={submitting}
                fullWidth
                InputLabelProps={InputLabelProps}
              />
              <RF.Field
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

function Toolbar() {
  const location = RRDom.useLocation()
  const { bucket } = parseSearch(location.search, true)
  const [open, setOpen] = React.useState(false)

  // FIXME
  // if (!bucket) return null

  return (
    <>
      <Button onClick={() => setOpen(true)} />
      <Popup
        bucket={bucket || 'fiskus-sandbox-dev'}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

function ToolbarWrapper({ columnPath }: ToolbarProps) {
  const pointer = JSONPointer.stringify(columnPath)
  switch (pointer) {
    case '/c':
      return <Toolbar />
    default:
      return null
  }
}

export default {
  Toolbar: ToolbarWrapper,
}
