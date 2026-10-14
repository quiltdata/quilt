// quilt-specs changes/access-code-signup#catalog-work. A role-owned cohort landing page at
// /signup/:page, distinct from the plain /signup (SignUp.jsx, unchanged).
//
// Known gap, not silently dropped: the Google button is omitted here. The spec
// (proposal.md "Password or Google signup with the ticket is otherwise the existing flow")
// means for the Google path to also carry the redeemed ticket through _api_login_oauth, but
// that composition (an SSO login endpoint running on every Google sign-in, against a
// ticket that only applies at first-time account creation) isn't designed yet -- see this
// PR's description. Shipping a Google button that silently signs the user in without
// granting the code's role would look correct while failing to do the one thing this
// feature exists for, so it's left out rather than guessed at.
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
import * as actions from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const MUTEX_CODE = 'code'
const MUTEX_SIGNUP = 'signup'

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
          <Layout.Message>Access code accepted</Layout.Message>
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
          {cfg.passwordAuth === true && (
            <>
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
            </>
          )}
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
    // An already-signed-in visitor redeems through the same page, which adds the role
    // without creating a new account -- not yet implemented in this component; the
    // registry's redeem endpoint supports it (mockup screen 6), the catalog UI for it is
    // a follow-up, not built here.
    return <Redirect to="/" />
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

  return (
    <Container title={pageInfo.title}>
      {ticket ? (
        <CompleteForm
          page={page}
          ticket={ticket}
          mutex={mutex}
          onDone={setDone}
          onExpired={() => {
            setTicket(null)
            setNotice('This signup link has expired. Enter the access code again.')
          }}
        />
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
