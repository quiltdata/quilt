// quilt-specs changes/access-code-signup#catalog-work. A role-owned cohort landing page at
// /signup/:page, distinct from the plain /signup (SignUp.jsx, unchanged).
// SSO runs in a popup (utils/OIDC), so the redeemed ticket stays in this page's state and
// rides along with the SSO login (#sso-redeem-work).
import * as FF from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'
import { useLocation, useParams, Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import useMutex from 'utils/useMutex'
import * as validators from 'utils/validators'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

import * as Layout from './Layout'
import SSOAzure from './SSOAzure'
import SSOGoogle from './SSOGoogle'
import SSOOkta from './SSOOkta'
import SSOOneLogin from './SSOOneLogin'
import * as actions from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const MUTEX_CODE = 'code'
const MUTEX_SIGNUP = 'signup'

const SSO_BUTTONS = [
  ['google', SSOGoogle],
  ['okta', SSOOkta],
  ['onelogin', SSOOneLogin],
  ['azure', SSOAzure],
]

const Container = Layout.mkLayout(({ title }) => title || 'Join Quilt')

function CodeEntry({ page, description, notice, initialCode, mutex, onRedeemed }) {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()

  const onSubmit = React.useCallback(
    async ({ code }) => {
      if (mutex.current) return
      mutex.claim(MUTEX_CODE)
      try {
        const result = defer()
        dispatch(actions.codeSignupRedeem({ page, code }, result.resolver))
        const ticket = await result.promise
        onRedeemed(ticket)
      } catch (e) {
        if (e instanceof errors.SignupCodeInvalid) {
          // eslint-disable-next-line consistent-return
          return { code: 'invalid' }
        }
        sentry('captureException', e)
        // eslint-disable-next-line consistent-return
        return { [FF.FORM_ERROR]: 'unexpected' }
      } finally {
        mutex.release(MUTEX_CODE)
      }
    },
    [dispatch, mutex, onRedeemed, page, sentry],
  )

  return (
    <>
      {!!notice && <Layout.Message>{notice}</Layout.Message>}
      {!!description && (
        <M.Typography variant="body2" color="textSecondary">
          {description}
        </M.Typography>
      )}
      <RF.Form onSubmit={onSubmit} initialValues={{ code: initialCode || '' }}>
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
            <RF.Field
              component={Layout.Field}
              name="code"
              validate={validators.required}
              disabled={!!mutex.current || submitting}
              floatingLabelText="Access code"
              errors={{
                required: 'Enter the access code',
                invalid: 'Invalid code',
              }}
            />
            <Layout.Error
              {...{
                submitFailed,
                error: error || (!modifiedSinceLastSubmit && submitError),
              }}
              errors={{ unexpected: 'Something went wrong. Try again later.' }}
            />
            <Layout.Actions>
              <Layout.Submit
                label="Continue"
                disabled={
                  !!mutex.current ||
                  submitting ||
                  (hasValidationErrors && submitFailed) ||
                  (hasSubmitErrors && !modifiedSinceLastSubmit)
                }
                busy={submitting}
              />
            </Layout.Actions>
          </form>
        )}
      </RF.Form>
    </>
  )
}

function CompleteForm({ page, ticket, mutex, onDone, onExpired }) {
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()

  const onSubmit = React.useCallback(
    async ({ username, email, password }) => {
      if (mutex.current) return
      mutex.claim(MUTEX_SIGNUP)
      try {
        const result = defer()
        // password is optional (changes/access-code-signup#password-decision): left blank,
        // the registry activates the account and emails a set-link instead of logging in.
        dispatch(
          actions.codeSignupComplete(
            { page, ticket, username, email, password: password || undefined },
            result.resolver,
          ),
        )
        await result.promise
        if (!password) {
          onDone('emailed')
          return
        }
        // The account is active (registry side), so sign in with the credentials just
        // submitted; CodeSignUp's `authenticated` check then redirects home. A sign-in
        // failure after the account exists is not a signup failure: say so instead of
        // "try again", which would only produce "Username taken".
        try {
          const signInResult = defer()
          dispatch(actions.signIn({ username, password }, signInResult.resolver))
          await signInResult.promise
        } catch (e) {
          sentry('captureException', e)
          onDone('created')
        }
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          // eslint-disable-next-line consistent-return
          return { username: 'taken' }
        }
        if (e instanceof errors.InvalidUsername) {
          // eslint-disable-next-line consistent-return
          return { username: 'invalid' }
        }
        if (e instanceof errors.EmailTaken) {
          // eslint-disable-next-line consistent-return
          return { email: 'taken' }
        }
        if (e instanceof errors.InvalidEmail) {
          // eslint-disable-next-line consistent-return
          return { email: 'invalid' }
        }
        if (e instanceof errors.InvalidPassword) {
          // eslint-disable-next-line consistent-return
          return { password: 'invalid' }
        }
        if (e instanceof errors.SignupTicketInvalid) {
          onExpired()
          return
        }
        if (e instanceof errors.PasswordAuthDisabled) {
          // eslint-disable-next-line consistent-return
          return { [FF.FORM_ERROR]: 'passwordAuthDisabled' }
        }
        if (e instanceof errors.SubscriptionInvalid) {
          // eslint-disable-next-line consistent-return
          return { [FF.FORM_ERROR]: 'subscriptionInvalid' }
        }
        if (e instanceof errors.SMTPError) {
          // eslint-disable-next-line consistent-return
          return { [FF.FORM_ERROR]: 'smtp' }
        }
        sentry('captureException', e)
        // eslint-disable-next-line consistent-return
        return { [FF.FORM_ERROR]: 'unexpected' }
      } finally {
        mutex.release(MUTEX_SIGNUP)
      }
    },
    [dispatch, mutex, onDone, onExpired, page, sentry, ticket],
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
          <RF.Field
            component={Layout.Field}
            name="username"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Username"
            errors={{
              required: 'Enter a username',
              taken: 'Username taken',
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
              taken: 'Email taken',
              invalid: 'Enter a valid email address',
            }}
          />
          <RF.Field
            component={Layout.Field}
            name="password"
            type="password"
            disabled={!!mutex.current || submitting}
            floatingLabelText="Password (optional)"
            errors={{ invalid: 'Password must be between 8 and 64 characters long' }}
          />
          <Layout.Hint>
            Leave the password blank and we&apos;ll email you a link to set one.
          </Layout.Hint>
          <Layout.Error
            {...{
              submitFailed,
              error: error || (!modifiedSinceLastSubmit && submitError),
            }}
            errors={{
              unexpected: 'Something went wrong. Try again later.',
              passwordAuthDisabled:
                'Email signup is not enabled on this Quilt. Ask your administrator for an invitation.',
              subscriptionInvalid:
                'Unable to sign up because of invalid subscription. Contact your Quilt administrator.',
              smtp: 'SMTP error: contact your Quilt administrator',
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
        </form>
      )}
    </RF.Form>
  )
}

export default function CodeSignUp() {
  const { page } = useParams()
  const { search } = useLocation()
  const authenticated = redux.useSelector(selectors.authenticated)
  const mutex = useMutex()

  const { code: initialCode } = parseSearch(search, true)

  const { urls } = NamedRoutes.use()

  const [pageInfo, setPageInfo] = React.useState(null)
  // null | 'notFound' | 'failed'
  const [pageError, setPageError] = React.useState(null)
  const [attempt, setAttempt] = React.useState(0)
  const [ticket, setTicket] = React.useState(null)
  const [notice, setNotice] = React.useState(null)
  // 'emailed' (blank password: a set-link was sent) or 'created' (the account exists but
  // the follow-up sign-in failed). The password branch otherwise signs in inside
  // CompleteForm, and the `authenticated` check below redirects home on its own.
  const [done, setDone] = React.useState(null)

  const dispatch = redux.useDispatch()

  React.useEffect(() => {
    let cancelled = false
    setPageError(null)
    const resolve = (info) => {
      if (!cancelled) setPageInfo(info)
    }
    const reject = (e) => {
      if (!cancelled)
        setPageError(e instanceof errors.SignupPageNotFound ? 'notFound' : 'failed')
    }
    dispatch(actions.getSignupPage(page, { resolve, reject }))
    return () => {
      cancelled = true
    }
  }, [dispatch, page, attempt])

  if (pageError === 'notFound') {
    return (
      <Container title="Page not found">
        <Layout.Message>This signup page does not exist.</Layout.Message>
      </Container>
    )
  }

  if (pageError === 'failed') {
    return (
      <Container title="Join Quilt">
        <Layout.Message>
          Could not load this signup page.{' '}
          <StyledLink onClick={() => setAttempt((n) => n + 1)}>Try again</StyledLink>
        </Layout.Message>
      </Container>
    )
  }

  // Wait for the page before deciding anything about a signed-in visitor, so a stale or
  // mistyped page shows "does not exist" instead of silently bouncing them home.
  if (!pageInfo) return null

  if (authenticated) {
    // Also where a successful signup lands. Redeeming a code while signed in is not built
    // (#signed-in-redeem-work).
    return <Redirect to={urls.home()} />
  }

  if (done === 'emailed') {
    return (
      <Container title={pageInfo.title}>
        <Layout.Message>
          Check your email for a link to set your password, then sign in.
        </Layout.Message>
      </Container>
    )
  }

  if (done === 'created') {
    return (
      <Container title={pageInfo.title}>
        <Layout.Message>
          Your account is ready, but signing you in failed.{' '}
          <StyledLink to={urls.signIn()}>Sign in</StyledLink> with the username and
          password you just chose.
        </Layout.Message>
      </Container>
    )
  }

  const ssoButtons = cfg.ssoAuth
    ? SSO_BUTTONS.filter(([provider]) => cfg.ssoProviders.includes(provider))
    : []
  const passwordSignup = cfg.passwordAuth === true

  if (!ssoButtons.length && !passwordSignup) {
    return (
      <Container title={pageInfo.title}>
        <Layout.Message>
          No signup method is enabled on this Quilt. Contact your Quilt administrator.
        </Layout.Message>
      </Container>
    )
  }

  const onExpired = () => {
    setTicket(null)
    setNotice('This signup link has expired. Enter the access code again.')
  }

  return (
    <Container title={pageInfo.title}>
      {ticket ? (
        <>
          <Layout.Message>Access code accepted</Layout.Message>
          {ssoButtons.length > 0 && (
            <M.Box display="flex" flexDirection="column" mt={2} alignItems="center">
              <M.Box display="flex" flexDirection="column">
                {ssoButtons.map(([provider, SSOButton]) => (
                  <React.Fragment key={provider}>
                    <M.Box mt={2} />
                    <SSOButton
                      mutex={mutex}
                      signup={{ page, ticket }}
                      onSignupTicketInvalid={onExpired}
                      style={{ justifyContent: 'flex-start' }}
                    />
                  </React.Fragment>
                ))}
              </M.Box>
            </M.Box>
          )}
          {ssoButtons.length > 0 && passwordSignup && <Layout.Or />}
          {passwordSignup && (
            <CompleteForm
              page={page}
              ticket={ticket}
              mutex={mutex}
              onDone={setDone}
              onExpired={onExpired}
            />
          )}
        </>
      ) : (
        <CodeEntry
          page={page}
          description={pageInfo.description}
          notice={notice}
          initialCode={initialCode}
          mutex={mutex}
          onRedeemed={(t) => {
            setNotice(null)
            setTicket(t)
          }}
        />
      )}
    </Container>
  )
}
