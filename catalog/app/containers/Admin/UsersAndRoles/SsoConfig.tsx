import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Lock from 'components/Lock'
import { loadMode } from 'components/FileEditor/loader'
import type * as Model from 'model'
import type * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import * as validators from 'utils/validators'

import SET_SSO_CONFIG_MUTATION from './gql/SetSsoConfig.generated'
import SSO_CONFIG_QUERY from './gql/SsoConfig.generated'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

type TextFieldProps = RF.FieldRenderProps<string> & M.TextFieldProps

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

const ERRORS = {
  required: 'Enter an SSO config',
}

function TextField({ input, meta }: TextFieldProps) {
  // TODO: lint yaml
  return (
    <TextEditor
      error={null}
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
  error: null | Error
}

function Form({
  close,
  error,
  ssoConfig,
  formApi: { dirtySinceLastSubmit, handleSubmit, pristine, submitting },
}: FormProps) {
  const classes = useStyles()
  return (
    <>
      <M.DialogTitle disableTypography>
        <M.Typography variant="h5">SSO config</M.Typography>
      </M.DialogTitle>
      <M.DialogContent>
        <RF.Field
          component={TextField}
          name="config"
          validate={validators.required as FF.FieldValidator<any>}
          placeholder="Enter SSO config"
          label="SSO config"
          fullWidth
          margin="normal"
          errors={ERRORS}
          initialValue={ssoConfig?.text}
        />
        {!!error && !dirtySinceLastSubmit && (
          <Lab.Alert className={classes.error} severity="error">
            {error.message}
          </Lab.Alert>
        )}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary" disabled={submitting}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={pristine || submitting}
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
  const [error, setError] = React.useState<null | Error>(null)

  const onSubmit = React.useCallback(
    async ({ config }: FormValues) => {
      try {
        const {
          admin: { setSsoConfig: r },
        } = await setSsoConfig({ config })
        switch (r.__typename) {
          case 'Ok':
            return close('submit')
          case 'InvalidInput':
            return setError(new Error('Unable to update SSO config'))
          case 'OperationError':
            return setError(new Error(`Unable to update SSO config: ${r.message}`))
          default:
            assertNever(r)
        }
      } catch (e) {
        return setError(e instanceof Error ? e : new Error('Error updating SSO config'))
      }
    },
    [close, setSsoConfig],
  )

  return (
    <RF.Form onSubmit={onSubmit}>
      {(formApi) =>
        children({ formApi, close, error: error, ssoConfig: data.admin?.ssoConfig })
      }
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
