import * as FF from 'final-form'
import * as R from 'ramda'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import useMutex from 'utils/useMutex'
import validate, * as validators from 'utils/validators'

import * as PasswordStrength from './PasswordStrength'
import * as Layout from './Layout'
import SSOAzure from './SSOAzure'
import SSOGoogle from './SSOGoogle'
import SSOOkta from './SSOOkta'
import SSOOneLogin from './SSOOneLogin'
import { signUp } from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const Container = Layout.mkLayout('Complete sign-up')

const MUTEX_ID = 'password'

const useWeakPasswordIconStyles = M.makeStyles((t) => ({
  icon: {
    color: t.palette.warning.dark,
  },
}))

function WeakPasswordIcon() {
  const classes = useWeakPasswordIconStyles()
  return (
    <M.Tooltip title="Password is too weak">
      <M.Icon className={classes.icon} fontSize="small" color="inherit">
        error_outline
      </M.Icon>
    </M.Tooltip>
  )
}

function PasswordField({ input, email, username, ...rest }) {
  const { value } = input
  const strength = PasswordStrength.useStrength(value, { email, username })
  const isWeak = strength?.score <= 2
  const helperText = strength?.feedback.suggestions.length
    ? `Hint: ${strength?.feedback.suggestions.join(' ')}`
    : ''
  return (
    <>
      <Layout.Field
        InputProps={{
          endAdornment: isWeak && (
            <M.InputAdornment position="end">
              <WeakPasswordIcon />
            </M.InputAdornment>
          ),
        }}
        helperText={helperText}
        type="password"
        floatingLabelText="Password"
        {...input}
        {...rest}
      />
      <PasswordStrength.Indicator strength={strength} />
    </>
  )
}

function PasswordSignUp({ mutex, next, onSuccess }) {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const { urls } = NamedRoutes.use()

  const [email, setEmail] = React.useState('')
  const [username, setName] = React.useState('')
  const onFormChange = React.useCallback(
    async ({ values }) => {
      if (email !== values.email) setEmail(values.email)
      if (username !== values.username) setName(values.username)
    },
    [email, username],
  )

  const onSubmit = React.useCallback(
    async (values) => {
      if (mutex.current) return
      mutex.claim(MUTEX_ID)
      try {
        const result = defer()
        dispatch(signUp(R.dissoc('passwordCheck', values), result.resolver))
        await result.promise
        onSuccess()
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          // eslint-disable-next-line consistent-return
          return {
            username: 'taken',
          }
        }
        if (e instanceof errors.InvalidUsername) {
          // eslint-disable-next-line consistent-return
          return {
            username: 'invalid',
          }
        }
        if (e instanceof errors.EmailTaken) {
          // eslint-disable-next-line consistent-return
          return {
            email: 'taken',
          }
        }
        if (e instanceof errors.InvalidEmail) {
          // eslint-disable-next-line consistent-return
          return {
            email: 'invalid',
          }
        }
        if (e instanceof errors.InvalidPassword) {
          // eslint-disable-next-line consistent-return
          return {
            password: 'invalid',
          }
        }
        if (e instanceof errors.SMTPError) {
          // eslint-disable-next-line consistent-return
          return {
            [FF.FORM_ERROR]: 'smtp',
          }
        }
        sentry('captureException', e)
        // eslint-disable-next-line consistent-return
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
    <RF.Form onSubmit={onSubmit}>
      {({
        error,
        handleSubmit,
        hasSubmitErrors,
        hasValidationErrors,
        modifiedSinceLastSubmit,
        submitError,
        submitFailed,
        submitting,
      }) => (
        <form onSubmit={handleSubmit}>
          <RF.FormSpy subscription={{ values: true }} onChange={onFormChange} />
          <RF.Field
            component={Layout.Field}
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
            component={Layout.Field}
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
            component={PasswordField}
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
            component={Layout.Field}
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
              smtp: 'SMTP error: contact your administrator',
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

export default ({ location: { search } }) => {
  const authenticated = redux.useSelector(selectors.authenticated)
  const cfg = Config.useConfig()
  const mutex = useMutex()

  const [done, setDone] = React.useState(false)

  const ssoEnabled = (provider) => {
    if (cfg.ssoAuth !== true) return false
    const { ssoProviders = [] } = cfg
    return provider ? ssoProviders.includes(provider) : !!ssoProviders.length
  }

  const { next } = parseSearch(search)

  if (authenticated) {
    return <Redirect to={next || '/'} />
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
