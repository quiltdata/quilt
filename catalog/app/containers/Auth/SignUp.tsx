import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'
import { useLocation, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import Placeholder from 'components/Placeholder'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import useMutex, { Mutex } from 'utils/useMutex'
import * as RT from 'utils/reactTools'
import validate, * as validators from 'utils/validators'

import * as Layout from './Layout'
import SSOAzure from './SSOAzure'
import SSOGoogle from './SSOGoogle'
import SSOOkta from './SSOOkta'
import SSOOneLogin from './SSOOneLogin'
import { signUp } from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const StrenghtenPasswordField = RT.mkLazy(
  () => import('./StrenghtenPasswordField'),
  SuspensePlaceholder,
)

const Container = Layout.mkLayout('Sign Up')

const MUTEX_ID = 'password'

// Field components (Layout.Field, StrenghtenPasswordField) accept extra props
// beyond react-final-form's FieldRenderProps; cast to satisfy the `component` prop.
type FieldComponent = React.ComponentType<any>

interface FormValues {
  username: string
  email: string
  password: string
  passwordCheck: string
}

interface PasswordSignUpProps {
  mutex: Mutex
  next?: string | string[]
  onSuccess: () => void
}

function PasswordSignUp({ mutex, next, onSuccess }: PasswordSignUpProps) {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const { urls } = NamedRoutes.use()

  const [email, setEmail] = React.useState('')
  const [username, setName] = React.useState('')
  const onFormChange = React.useCallback(
    ({ modified, values }: FF.FormState<FormValues>) => {
      if (modified?.email) setEmail(values.email)
      if (modified?.username) setName(values.username)
    },
    [],
  )

  const onSubmit = React.useCallback(
    async (values: FormValues) => {
      if (mutex.current) return undefined
      mutex.claim(MUTEX_ID)
      try {
        const result = defer()
        dispatch(signUp(R.dissoc('passwordCheck', values), result.resolver))
        await result.promise
        onSuccess()
        return undefined
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          return {
            username: 'taken',
          }
        }
        if (e instanceof errors.InvalidUsername) {
          return {
            username: 'invalid',
          }
        }
        if (e instanceof errors.EmailTaken) {
          return {
            email: 'taken',
          }
        }
        if (e instanceof errors.InvalidEmail) {
          return {
            email: 'invalid',
          }
        }
        if (e instanceof errors.InvalidPassword) {
          return {
            password: 'invalid',
          }
        }
        if (e instanceof errors.NoDefaultRole) {
          return {
            [FF.FORM_ERROR]: 'noDefaultRole',
          }
        }
        if (e instanceof errors.SMTPError) {
          return {
            [FF.FORM_ERROR]: 'smtp',
          }
        }
        if (e instanceof errors.SubscriptionInvalid) {
          return {
            [FF.FORM_ERROR]: 'subscriptionInvalid',
          }
        }
        sentry('captureException', e)
        return {
          [FF.FORM_ERROR]: 'unexpected',
        }
      } finally {
        mutex.release(MUTEX_ID)
      }
    },
    [dispatch, mutex, onSuccess, sentry],
  )

  return (
    <RF.Form<FormValues> onSubmit={onSubmit}>
      {({
        error,
        handleSubmit,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
        submitError,
        submitFailed,
        submitting,
      }: RF.FormRenderProps<FormValues>) => (
        <form onSubmit={handleSubmit}>
          <RF.FormSpy<FormValues>
            subscription={{ values: true, modified: true }}
            onChange={onFormChange}
          />
          <RF.Field
            component={Layout.Field as FieldComponent}
            name="username"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Username"
            errors={{
              required: 'Enter a username',
              taken: (
                <>
                  Username taken, try{' '}
                  <Layout.FieldErrorLink to={urls.signIn(next)}>
                    signing in
                  </Layout.FieldErrorLink>
                </>
              ),
              invalid: 'Username invalid',
            }}
          />
          <RF.Field
            component={Layout.Field as FieldComponent}
            name="email"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Email"
            errors={{
              required: 'Enter your email',
              taken: (
                <>
                  Email taken, try{' '}
                  <Layout.FieldErrorLink to={urls.signIn(next)}>
                    signing in
                  </Layout.FieldErrorLink>
                </>
              ),
              invalid: 'Enter a valid email address',
            }}
          />
          <RF.Field
            component={StrenghtenPasswordField as FieldComponent}
            name="password"
            validate={validators.required}
            username={username}
            email={email}
            disabled={!!mutex.current || submitting}
            errors={{
              required: 'Enter a password',
              invalid: 'Password must be between 8 and 64 characters long',
            }}
          />
          <RF.Field
            component={Layout.Field as FieldComponent}
            name="passwordCheck"
            type="password"
            validate={validators.composeAsync(
              validators.required,
              validate('check', validators.matchesField('password')),
            )}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Verify password"
            errors={{
              required: 'Enter the password again',
              check: 'Passwords must match',
            }}
          />
          <Layout.Error
            {...{
              submitFailed,
              error: error || (!modifiedSinceLastSubmit && submitError),
            }}
            errors={{
              unexpected: 'Something went wrong. Try again later.',
              smtp: 'SMTP error: contact your Quilt administrator',
              noDefaultRole:
                'Unable to assign role. Ask your Quilt administrator to set a default role.',
              subscriptionInvalid:
                'Unable to sign up because of invalid subscription. Contact your Quilt administrator.',
            }}
          />
          <Layout.Actions>
            <Layout.Submit
              label="Sign up"
              disabled={
                !!mutex.current ||
                submitting ||
                (hasValidationErrors && submitFailed) ||
                (hasSubmitErrors && !modifiedSinceLastSubmit)
              }
              busy={submitting}
            />
          </Layout.Actions>
          <Layout.Hint>
            <>
              Already have an account? <Link to={urls.signIn(next)}>Sign in</Link>
            </>
          </Layout.Hint>
        </form>
      )}
    </RF.Form>
  )
}

export default function SignUp() {
  const { search } = useLocation()
  const authenticated = redux.useSelector(selectors.authenticated)
  const mutex = useMutex()

  const [done, setDone] = React.useState(false)

  const ssoEnabled = (provider?: string) => {
    if (cfg.ssoAuth !== true) return false
    return provider ? cfg.ssoProviders.includes(provider) : !!cfg.ssoProviders.length
  }

  const { next } = parseSearch(search) as { next?: string }

  if (authenticated) {
    return <Redirect to={(next as string) || '/'} />
  }

  if (done)
    return (
      <Container>
        <Layout.Message>
          You have signed up for Quilt. Check your email for further instructions.
        </Layout.Message>
      </Container>
    )

  return (
    <Container>
      {ssoEnabled() && (
        <M.Box display="flex" flexDirection="column" mt={2} alignItems="center">
          <M.Box display="flex" flexDirection="column">
            {ssoEnabled('google') && (
              <>
                <M.Box mt={2} />
                <SSOGoogle
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
            {ssoEnabled('okta') && (
              <>
                <M.Box mt={2} />
                <SSOOkta
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
            {ssoEnabled('onelogin') && (
              <>
                <M.Box mt={2} />
                <SSOOneLogin
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
            {ssoEnabled('azure') && (
              <>
                <M.Box mt={2} />
                <SSOAzure
                  mutex={mutex}
                  next={next}
                  style={{ justifyContent: 'flex-start' }}
                />
              </>
            )}
          </M.Box>
        </M.Box>
      )}
      {cfg.passwordAuth === true && ssoEnabled() && <Layout.Or />}
      {cfg.passwordAuth === true && (
        <PasswordSignUp mutex={mutex} onSuccess={() => setDone(true)} next={next} />
      )}
    </Container>
  )
}
