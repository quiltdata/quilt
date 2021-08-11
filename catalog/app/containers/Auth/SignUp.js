import * as React from 'react'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import { composeComponent } from 'utils/reactTools'
import useMutex from 'utils/useMutex'
import validate, * as validators from 'utils/validators'

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

const PasswordSignUp = composeComponent(
  'Auth.SignUp.Password',
  Sentry.inject(),
  reduxForm({
    form: 'Auth.SignUp.Password',
    onSubmit: async (values, dispatch, { onSuccess, mutex, sentry }) => {
      if (mutex.current) return
      mutex.claim(MUTEX_ID)
      try {
        const result = defer()
        dispatch(signUp(values.remove('passwordCheck').toJS(), result.resolver))
        await result.promise
        onSuccess()
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          throw new SubmissionError({ username: 'taken' })
        }
        if (e instanceof errors.InvalidUsername) {
          throw new SubmissionError({ username: 'invalid' })
        }
        if (e instanceof errors.EmailTaken) {
          throw new SubmissionError({ email: 'taken' })
        }
        if (e instanceof errors.InvalidEmail) {
          throw new SubmissionError({ email: 'invalid' })
        }
        if (e instanceof errors.InvalidPassword) {
          throw new SubmissionError({ password: 'invalid' })
        }
        if (e instanceof errors.SMTPError) {
          throw new SubmissionError({ _error: 'smtp' })
        }
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      } finally {
        mutex.release(MUTEX_ID)
      }
    },
  }),
  ({ next, mutex, handleSubmit, submitting, submitFailed, invalid, error }) => {
    const { urls } = NamedRoutes.use()
    return (
      <form onSubmit={handleSubmit}>
        <Field
          component={Layout.Field}
          name="username"
          validate={[validators.required]}
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
        <Field
          component={Layout.Field}
          name="email"
          validate={[validators.required]}
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
        <Field
          component={Layout.Field}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={!!mutex.current || submitting}
          floatingLabelText="Password"
          errors={{
            required: 'Enter a password',
            invalid: 'Password must be at least 8 characters long',
          }}
        />
        <Field
          component={Layout.Field}
          name="passwordCheck"
          type="password"
          validate={[
            validators.required,
            validate('check', validators.matchesField('password')),
          ]}
          disabled={!!mutex.current || submitting}
          floatingLabelText="Verify password"
          errors={{
            required: 'Enter the password again',
            check: 'Passwords must match',
          }}
        />
        <Layout.Error
          {...{ submitFailed, error }}
          errors={{
            unexpected: 'Something went wrong. Try again later.',
            smtp: 'SMTP error: contact your administrator',
          }}
        />
        <Layout.Actions>
          <Layout.Submit
            label="Sign up"
            disabled={!!mutex.current || submitting || (submitFailed && invalid)}
            busy={submitting}
          />
        </Layout.Actions>
        <Layout.Hint>
          <>
            Already have an account? <Link to={urls.signIn(next)}>Sign in</Link>
          </>
        </Layout.Hint>
      </form>
    )
  },
)

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
