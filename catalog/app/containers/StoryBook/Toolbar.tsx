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

function MetadataSchemaField({
  bucket,
  input,
  meta,
  errors,
  helperText,
  InputLabelProps,
  ...rest
}: FieldProps & M.TextFieldProps) {
  const { urls } = NamedRoutes.use()
  const href = React.useMemo(() => {
    urls.bucketFile(bucket, `.quilt/workflows/${input.value}.json`)
  }, [urls, bucket, input.value])
  const error = meta.submitFailed && (meta.error || meta.submitError)
  const props = {
    error: !!error,
    helperText: error ? errors[error] || error : helperText,
    disabled: meta.submitting || meta.submitSucceeded,
    InputLabelProps: { shrink: true, ...InputLabelProps },
    InputProps: {
      endAdornment: (
        <a href={href} target="_blank">
          <M.IconButton>
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

function validateMetadataSchemaName() {
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
                bucket={bucket}
                component={MetadataSchemaField}
                name="metadata_schema"
                label="Metadata JSON Schema name"
                placeholder="mySchema1"
                validate={validateMetadataSchemaName}
                errors={emptyObject}
                disabled={submitting}
                fullWidth
                InputLabelProps={InputLabelProps}
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
  const { bucket } = parseSearch(location.search)
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} />
      <Popup bucket={bucket} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function ToolbarWrapper({ columnPath }: ToolbarProps) {
  const pointer = JSONPointer.stringify(columnPath)
  switch (pointer) {
    case '/c':
      return <Toolbar bucket={bucket} />
    default:
      return null
  }
}

export default {
  Toolbar: ToolbarWrapper,
}
