import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
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

const TEXT_FIELD_ERRORS = {
  required: 'Enter an SSO config',
}

const FORM_ERRORS = {
  unexpected: 'Unable to update SSO config: something went wrong',
}

type TextFieldProps = RF.FieldRenderProps<string> &
  M.TextFieldProps & { className: string }

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

function TextField({ className, errors, input, meta }: TextFieldProps) {
  // TODO: lint yaml
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined
  return (
    <TextEditor
      className={className}
      error={errorMessage ? new Error(errorMessage) : null}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
      initialValue={meta.initial}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  delete: {
    background: t.palette.error.light,
    color: t.palette.error.contrastText,
    marginRight: 'auto',
    '&:hover': {
      background: t.palette.error.main,
    },
  },
  editor: {
    minHeight: t.spacing(30),
  },
  error: {
    marginTop: t.spacing(2),
  },
  lock: {
    bottom: t.spacing(6.5),
    top: t.spacing(8),
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
  const confirm = useConfirm({
    title: 'You are about to delete SSO mapping config',
    submitTitle: 'Delete',
    onSubmit: (confirmed) => (confirmed ? onDelete() : Promise.resolve()),
  })
  return (
    <>
      {confirm.render(<></>)}
      <M.DialogTitle disableTypography>
        <M.Typography variant="h5">SSO role mapping config</M.Typography>
      </M.DialogTitle>
      <M.DialogContent>
        <RF.Field
          component={TextField}
          errors={TEXT_FIELD_ERRORS}
          initialValue={ssoConfig?.text}
          label="SSO config"
          name="config"
          validate={validators.required as FF.FieldValidator<any>}
          className={classes.editor}
        />
        {submitFailed && (
          <>
            <FormError error={error || submitError} errors={FORM_ERRORS} />
            <M.Typography variant="body2">
              Learn more about{' '}
              <StyledLink
                href={`${docs}/quilt-platform-administrator/advanced/sso-permissions`}
                target="_blank"
              >
                SSO permissions mapping
              </StyledLink>
              .
            </M.Typography>
          </>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button
          onClick={confirm.open}
          color="inherit"
          disabled={submitting}
          className={classes.delete}
        >
          Delete
        </M.Button>
        <M.Button onClick={() => close('cancel')} color="primary" disabled={submitting}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={pristine || submitting || (submitFailed && hasValidationErrors)}
          onClick={handleSubmit}
        >
          Save
        </M.Button>
      </M.DialogActions>
      {submitting && (
        <Lock className={classes.lock}>
          <M.CircularProgress size={80} />
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
  loadMode('yaml')
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

interface SuspendedProps {
  close: Dialogs.Close<string | void>
}

export default function Suspended({ close }: SuspendedProps) {
  return (
    <React.Suspense
      fallback={
        <M.Box m="32px auto">
          <M.CircularProgress size={80} />
        </M.Box>
      }
    >
      <Data close={close}>{(props) => <Form {...props} />}</Data>
    </React.Suspense>
  )
}
