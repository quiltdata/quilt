import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import Lock from 'components/Lock'
import { loadMode } from 'components/FileEditor/loader'
import * as Notifications from 'containers/Notifications'
import type * as Model from 'model'
import type * as Dialogs from 'utils/GlobalDialogs'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import * as validators from 'utils/validators'

import SET_SSO_CONFIG_MUTATION from './gql/SetSsoConfig.generated'
import SSO_CONFIG_QUERY from './gql/SsoConfig.generated'

const TextEditor = React.lazy(() => import('components/FileEditor/TextEditor'))

// TODO: wait for mutation result
// TODO: show error in dialog
// TODO: move  onSubmit to Suspended
// TODO: validate yaml

type TextFieldProps = RF.FieldRenderProps<string> & M.TextFieldProps

const TEXT_EDITOR_TYPE = { brace: 'yaml' as const }

const ERRORS = {
  required: 'Enter an SSO config',
}

function TextField({ input }: TextFieldProps) {
  return <TextEditor {...input} error={null} type={TEXT_EDITOR_TYPE} />
}

const useStyles = M.makeStyles({
  lock: {
    bottom: 52,
    top: 64,
  },
})

interface FormProps
  extends Pick<RF.FormRenderProps, 'handleSubmit' | 'pristine' | 'submitting'> {
  close: Dialogs.Close<string | void>
  ssoConfig: Pick<Model.GQLTypes.SsoConfig, 'text'> | null
}

function Form({ close, handleSubmit, pristine, ssoConfig, submitting }: FormProps) {
  const classes = useStyles()
  return (
    <form onSubmit={handleSubmit}>
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
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary" disabled={submitting}>
          Cancel
        </M.Button>
        <M.Button color="primary" disabled={pristine || submitting} type="submit">
          Save
        </M.Button>
      </M.DialogActions>
      {submitting && (
        <Lock className={classes.lock}>
          <M.CircularProgress size={80} />
        </Lock>
      )}
    </form>
  )
}

interface SsoConfigProps {
  children: (props: $TSFixMe) => React.ReactNode
  close: Dialogs.Close<string | void>
}

function Data({ children, close }: SsoConfigProps) {
  const { push } = Notifications.use()

  const data = GQL.useQueryS(SSO_CONFIG_QUERY)
  loadMode('yaml')
  const setSsoConfig = GQL.useMutation(SET_SSO_CONFIG_MUTATION)

  const submit = React.useCallback(
    async (config: string) => {
      try {
        const {
          admin: { setSsoConfig: r },
        } = await setSsoConfig({ config })
        switch (r.__typename) {
          case 'Ok':
            return
          case 'InvalidInput':
            // shouldnt happen
            push('Unable to update SSO config')
            return
          case 'OperationError':
            push(`Unable to update SSO config: ${r.message}`)
            return
          default:
            assertNever(r)
        }
      } catch (e) {
        push('Error updating SSO config')
        // eslint-disable-next-line no-console
        console.error('Error deleting policy')
        // eslint-disable-next-line no-console
        console.error(e)
      }
    },
    [push, setSsoConfig],
  )

  const onSubmit = React.useCallback(
    ({ config }) => close(submit(config)),
    [close, submit],
  )

  return (
    <RF.Form onSubmit={onSubmit}>
      {(props) => children({ ...props, close, ssoConfig: data.admin?.ssoConfig })}
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
