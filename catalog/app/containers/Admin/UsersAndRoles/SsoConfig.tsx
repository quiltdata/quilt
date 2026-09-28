import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import { ErrorBoundary } from 'react-error-boundary'
import * as M from '@material-ui/core'

import { useConfirm } from 'components/Dialog'
import Lock from 'components/Lock'
import { loadMode } from 'components/FileEditor/loader'
import { docs } from 'constants/urls'
import type * as Model from 'model'
import type * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import { mkFormError, mapInputErrors } from 'utils/formTools'
import * as validators from 'utils/validators'

import { FormError } from '../Form'

import SET_SSO_CONFIG_MUTATION from './gql/SetSsoConfig.generated'
import SSO_CONFIG_QUERY from './gql/SsoConfig.generated'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

const DOCS_URL = `${docs}/quilt-platform-administrator/advanced/sso-permissions`

const TEXT_FIELD_ERRORS = {
  required: 'Enter an SSO config',
}

const FORM_ERRORS = {
  unexpected: 'Unable to update SSO config: something went wrong',
}

type TextFieldProps = RF.FieldRenderProps<string> &
  M.TextFieldProps & { className: string }

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

const useEditorStyles = M.makeStyles((t) => ({
  root: {
    minHeight: t.spacing(30),
  },
  // Stands in for the editor at its own height, so the dialog does not resize when
  // the chunk arrives.
  placeholder: {
    alignItems: 'center',
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    justifyContent: 'center',
    minHeight: t.spacing(30),
  },
}))

interface EditorProps {
  className: string
  error: Error | null
  initialValue?: string
  onChange: (value: string) => void
}

// `loadMode` suspends; brace resolves `ace/mode/yaml` from a registry the mode module
// populates, so it has to load before TextEditor mounts.
function Editor({ className, error, initialValue, onChange }: EditorProps) {
  loadMode(TEXT_EDITOR_TYPE.brace)
  return (
    <TextEditor
      className={className}
      error={error}
      onChange={onChange}
      type={TEXT_EDITOR_TYPE}
      initialValue={initialValue}
    />
  )
}

function EditorFallback({ error }: { error: Error }) {
  const classes = useEditorStyles()
  return (
    <div className={classes.placeholder}>
      <M.Typography variant="body2" color="error">
        Could not load the editor: {error.message}
      </M.Typography>
    </div>
  )
}

function TextField({ errors, input, meta }: TextFieldProps) {
  const classes = useEditorStyles()
  // TODO: lint yaml
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined
  return (
    // Both boundaries are the field's own: the editor is a lazy chunk and its mode is a
    // second one, so without them a slow load leaves the dialog a bare spinner and a
    // failed one replaces the whole admin page, in each case with nothing to cancel with.
    <ErrorBoundary FallbackComponent={EditorFallback}>
      <React.Suspense
        fallback={
          <div className={classes.placeholder}>
            <M.CircularProgress size={24} />
          </div>
        }
      >
        <Editor
          className={classes.root}
          error={errorMessage ? new Error(errorMessage) : null}
          onChange={input.onChange}
          initialValue={meta.initial}
        />
      </React.Suspense>
    </ErrorBoundary>
  )
}

const useStyles = M.makeStyles((t) => ({
  intro: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    marginBottom: t.spacing(2),
  },
  status: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(2),
  },
  tag: {
    ...t.typography.caption,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    color: t.palette.text.secondary,
    lineHeight: 1.6,
    padding: t.spacing(0, 0.75),
    whiteSpace: 'nowrap',
  },
  tagOn: {
    borderColor: t.palette.secondary.main,
    color: t.palette.secondary.dark,
  },
  // A destructive action does not wear the weight of the primary one: text, error
  // ink, and pushed away from Save so it is not a neighbouring click.
  delete: {
    color: t.palette.error.main,
    marginRight: 'auto',
  },
  error: {
    marginTop: t.spacing(2),
  },
}))

type FormValues = Record<'config', string>

interface FormProps {
  close: Dialogs.Close<string | void>
  formApi: RF.FormRenderProps<FormValues>
  onDelete: () => Promise<void>
  ssoConfig: Pick<Model.GQLTypes.SsoConfig, 'text'> | null
}

function Form({
  close,
  formApi: {
    error,
    handleSubmit,
    hasValidationErrors,
    pristine,
    submitError,
    submitFailed,
    submitting,
  },
  onDelete,
  ssoConfig,
}: FormProps) {
  const classes = useStyles()
  const configured = !!ssoConfig?.text
  const confirm = useConfirm({
    title: 'You are about to delete SSO mapping config',
    submitTitle: 'Delete',
    onSubmit: (confirmed) => confirmed && onDelete(),
  })
  return (
    <>
      {confirm.render(<></>)}
      <M.DialogTitle disableTypography>
        <M.Typography variant="h5">SSO role mapping</M.Typography>
      </M.DialogTitle>
      <M.DialogContent>
        <div className={classes.status}>
          <span className={configured ? `${classes.tag} ${classes.tagOn}` : classes.tag}>
            {configured ? 'Active' : 'Not configured'}
          </span>
          <span>
            {configured
              ? 'Roles come from this mapping, so role assignment is read-only on those users.'
              : 'Without a mapping, every user keeps the role assigned to them here.'}
          </span>
        </div>
        <div className={classes.intro}>
          Maps the groups your identity provider sends onto Quilt roles.{' '}
          <StyledLink href={DOCS_URL} target="_blank">
            How the mapping works
          </StyledLink>
          .
        </div>
        <RF.Field
          component={TextField}
          errors={TEXT_FIELD_ERRORS}
          initialValue={ssoConfig?.text}
          label="SSO config"
          name="config"
          validate={validators.required as FF.FieldValidator<any>}
        />
        {submitFailed && (
          <div className={classes.error}>
            <FormError error={error || submitError} errors={FORM_ERRORS} />
          </div>
        )}
      </M.DialogContent>
      <M.DialogActions>
        {configured && (
          <M.Button
            onClick={confirm.open}
            disabled={submitting}
            className={classes.delete}
          >
            Delete mapping
          </M.Button>
        )}
        <M.Button onClick={() => close('cancel')} color="primary" disabled={submitting}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          variant="contained"
          disabled={pristine || submitting || (submitFailed && hasValidationErrors)}
          onClick={handleSubmit}
        >
          Save
        </M.Button>
      </M.DialogActions>
      {submitting && (
        <Lock>
          <M.CircularProgress size={48} />
        </Lock>
      )}
    </>
  )
}

interface DataProps {
  children: (props: FormProps) => React.ReactNode
  close: Dialogs.Close<string | void>
}

function Data({ children, close }: DataProps) {
  const data = GQL.useQueryS(SSO_CONFIG_QUERY)
  const setSsoConfig = GQL.useMutation(SET_SSO_CONFIG_MUTATION)

  const submitConfig = React.useCallback(
    async (config: string | null) => {
      try {
        const {
          admin: { setSsoConfig: r },
        } = await setSsoConfig({ config })
        if (!r && !config) {
          close('submit')
          return undefined
        }
        if (!r) return assertNever(r as never)
        switch (r.__typename) {
          case 'SsoConfig':
            close('submit')
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
    [close, setSsoConfig],
  )
  const onSubmit = React.useCallback(
    ({ config }: FormValues) => (config ? submitConfig(config) : { config: 'required' }),
    [submitConfig],
  )
  const [deleting, setDeleting] = React.useState<
    FF.SubmissionErrors | boolean | undefined
  >()
  const onDelete = React.useCallback(async (): Promise<void> => {
    setDeleting(true)
    const errors = await submitConfig(null)
    setDeleting(errors)
  }, [submitConfig])

  return (
    <RF.Form onSubmit={onSubmit}>
      {(formApi) =>
        children({
          onDelete,
          // eslint-disable-next-line no-nested-ternary
          formApi: !deleting
            ? formApi
            : deleting === true
              ? { ...formApi, submitting: true }
              : {
                  ...formApi,
                  submitError: deleting[FF.FORM_ERROR] || formApi.submitError,
                  submitFailed: true,
                },
          close,
          ssoConfig: data.admin?.ssoConfig,
        })
      }
    </RF.Form>
  )
}

const useSkeletonStyles = M.makeStyles((t) => ({
  body: {
    padding: t.spacing(3),
  },
  bar: {
    minHeight: t.spacing(30),
  },
}))

// The config read is the only thing this waits on, and it keeps the dialog's shape
// while it does, so opening the dialog never shows a bare box.
function Skeleton() {
  const classes = useSkeletonStyles()
  return (
    <>
      <M.DialogTitle disableTypography>
        <M.Typography variant="h5">SSO role mapping</M.Typography>
      </M.DialogTitle>
      <M.DialogContent className={classes.body}>
        <M.LinearProgress />
        <div className={classes.bar} />
      </M.DialogContent>
    </>
  )
}

interface SuspendedProps {
  close: Dialogs.Close<string | void>
}

export default function Suspended({ close }: SuspendedProps) {
  return (
    // The config query suspends here, so a failed read without this boundary escapes
    // the dialog entirely and replaces the admin page behind it, leaving nothing to
    // cancel with.
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <>
          <M.DialogTitle disableTypography>
            <M.Typography variant="h5">SSO role mapping</M.Typography>
          </M.DialogTitle>
          <M.DialogContent>
            <M.Typography variant="body2" color="error">
              Could not load the SSO configuration: {error.message}
            </M.Typography>
          </M.DialogContent>
          <M.DialogActions>
            <M.Button onClick={() => close()}>Close</M.Button>
          </M.DialogActions>
        </>
      )}
    >
      <React.Suspense fallback={<Skeleton />}>
        <Data close={close}>{(props) => <Form {...props} />}</Data>
      </React.Suspense>
    </ErrorBoundary>
  )
}
