import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import Lock from 'components/Lock'
import { loadMode } from 'components/FileEditor/loader'
import type * as Model from 'model'
import type * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
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

type TextFieldProps = RF.FieldRenderProps<string> & M.TextFieldProps

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

function TextField({ errors, input, meta }: TextFieldProps) {
  // TODO: lint yaml
  const error = meta.error || meta.submitError
  const errorMessage = meta.submitFailed && error ? errors[error] || error : undefined
  return (
    <TextEditor
      error={errorMessage ? new Error(errorMessage) : null}
      onChange={input.onChange}
      type={TEXT_EDITOR_TYPE}
      value={meta.initial}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  lock: {
    bottom: t.spacing(6.5),
    top: t.spacing(8),
  },
  error: {
    marginTop: t.spacing(2),
  },
}))

type FormValues = Record<'config', string>

interface FormProps {
  formApi: RF.FormRenderProps<FormValues>
  close: Dialogs.Close<string | void>
  ssoConfig: Pick<Model.GQLTypes.SsoConfig, 'text'> | null
}

function Form({
  close,
  ssoConfig,
  formApi: {
    error,
    handleSubmit,
    hasValidationErrors,
    pristine,
    submitError,
    submitFailed,
    submitting,
  },
}: FormProps) {
  const classes = useStyles()
  return (
    <>
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
        />
        {submitFailed && <FormError error={error || submitError} errors={FORM_ERRORS} />}
      </M.DialogContent>
      <M.DialogActions>
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

  const onSubmit = React.useCallback(
    async ({ config }: FormValues) => {
      try {
        if (!config) {
          return { config: 'required' }
        }
        const {
          admin: { setSsoConfig: r },
        } = await setSsoConfig({ config })
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
        console.error('Error updating policy')
        // eslint-disable-next-line no-console
        console.error(e)
        return mkFormError('unexpected')
      }
    },
    [close, setSsoConfig],
  )

  return (
    <RF.Form onSubmit={onSubmit}>
      {(formApi) => children({ formApi, close, ssoConfig: data.admin?.ssoConfig })}
    </RF.Form>
  )
}

interface SuspendedProps {
  close: Dialogs.Close<string | void>
}

export default function Suspended({ close }: SuspendedProps) {
  return (
    <React.Suspense fallback={<M.CircularProgress size={80} />}>
      <Data close={close}>{(props) => <Form {...props} />}</Data>
    </React.Suspense>
  )
}
