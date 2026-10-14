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

import * as Sentry from 'utils/Sentry'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import useMutex from 'utils/useMutex'
import * as validators from 'utils/validators'

import * as Layout from './Layout'
import * as actions from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const MUTEX_CODE = 'code'
const MUTEX_SIGNUP = 'signup'

const Container = Layout.mkLayout(({ title }) => title || 'Join Quilt')

function CodeEntry({ page, title, description, initialCode, mutex, onRedeemed }) {
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
      {!!title && <M.Typography variant="h5">{title}</M.Typography>}
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

function CompleteForm({ page, ticket, mutex, onDone }) {
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
          onDone()
          return
        }
        // Fixed per code review: a Redirect to /signin?next=...#done was dead -- nothing
        // reads location.hash, so the "done" state never rendered. The account is already
        // active (registry side), so sign in directly with the credentials just submitted
        // rather than bouncing through a sign-in page at all. CodeSignUp's own
        // `authenticated` check picks this up on the next render and redirects home.
        const signInResult = defer()
        dispatch(actions.signIn({ username, password }, signInResult.resolver))
        await signInResult.promise
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
          // eslint-disable-next-line consistent-return
          return { [FF.FORM_ERROR]: 'ticketExpired' }
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
    [dispatch, mutex, onDone, page, sentry, ticket],
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
            errors={{ required: 'Enter a username', taken: 'Username taken', invalid: 'Username invalid' }}
          />
          <RF.Field
            component={Layout.Field}
            name="email"
            validate={validators.required}
            disabled={!!mutex.current || submitting}
            floatingLabelText="Email"
            errors={{ required: 'Enter your email', taken: 'Email taken', invalid: 'Enter a valid email address' }}
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
              ticketExpired: 'This signup link has expired. Go back and enter the code again.',
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

  const [pageInfo, setPageInfo] = React.useState(null)
  const [pageError, setPageError] = React.useState(false)
  const [ticket, setTicket] = React.useState(null)
  // Set only on the blank-password branch: the password branch signs in directly inside
  // CompleteForm, and the `authenticated` check above then redirects home on its own.
  const [pending, setPending] = React.useState(false)

  const dispatch = redux.useDispatch()

  React.useEffect(() => {
    let cancelled = false
    const resolve = (info) => {
      if (!cancelled) setPageInfo(info)
    }
    const reject = () => {
      if (!cancelled) setPageError(true)
    }
    dispatch(actions.getSignupPage(page, { resolve, reject }))
    return () => {
      cancelled = true
    }
  }, [dispatch, page])

  // Fixed per code review: pageError must be checked before authenticated, or a signed-in
  // visitor hitting a stale/mistyped page is silently bounced to `/` instead of seeing
  // "This signup page does not exist."
  if (pageError) {
    return (
      <Container title="Page not found">
        <Layout.Message>This signup page does not exist.</Layout.Message>
      </Container>
    )
  }

  if (authenticated) {
    // An already-signed-in visitor redeems through the same page, which adds the role
    // without creating a new account -- not yet implemented in this component; the
    // registry's redeem endpoint supports it (mockup screen 6), the catalog UI for it is
    // a follow-up, not built here.
    return <Redirect to="/" />
  }

  if (!pageInfo) return null

  if (pending) {
    return (
      <Container title={pageInfo.title}>
        <Layout.Message>
          Check your email for a link to set your password, then sign in.
        </Layout.Message>
      </Container>
    )
  }

  return (
    <Container title={pageInfo.title}>
      {ticket ? (
        <CompleteForm page={page} ticket={ticket} mutex={mutex} onDone={() => setPending(true)} />
      ) : (
        <CodeEntry
          page={page}
          title={null}
          description={pageInfo.description}
          initialCode={initialCode}
          mutex={mutex}
          onRedeemed={setTicket}
        />
      )}
    </Container>
  )
}
