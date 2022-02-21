import { FORM_ERROR } from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'
import { useHistory } from 'react-router-dom'

import Working from 'components/Working'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import validate, * as validators from 'utils/validators'

import * as Layout from './Layout'
import { useSignOut } from './SignOut'
import { changePassword } from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const Container = Layout.mkLayout('Change Password')

function SignOut() {
  const waiting = redux.useSelector(selectors.waiting)
  const signOutRef = React.useRef<() => void>()
  signOutRef.current = useSignOut()
  React.useEffect(() => {
    if (!waiting) signOutRef.current!()
  }, [waiting, signOutRef])
  return (
    <Container>
      <Working style={{ textAlign: 'center' }}>Signing out</Working>
    </Container>
  )
}

interface FormProps {
  onSuccess(): void
  link: string
}

function Form({ onSuccess, link }: FormProps) {
  const { urls } = NamedRoutes.use()
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()

  const onSubmit = async ({ password }: { password: string }) => {
    try {
      const result = defer()
      dispatch(changePassword(link, password, result.resolver))
      await result.promise
      onSuccess()
      return undefined
    } catch (e) {
      if (e instanceof errors.PassChangeInvalidToken) {
        return { [FORM_ERROR]: 'invalidToken' }
      }
      if (e instanceof errors.PassChangeNotAllowed) {
        return { [FORM_ERROR]: 'notAllowed' }
      }
      if (e instanceof errors.PassChangeUserNotFound) {
        return { [FORM_ERROR]: 'userNotFound' }
      }
      if (e instanceof errors.InvalidPassword) {
        return { [FORM_ERROR]: 'invalid' }
      }
      sentry('captureException', e)
      return { [FORM_ERROR]: 'unexpected' }
    }
  }

  return (
    <Container>
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
              // @ts-expect-error
              component={Layout.Field}
              name="password"
              type="password"
              // @ts-expect-error
              validate={validators.required}
              disabled={submitting}
              floatingLabelText="New password"
              errors={{
                required: 'Enter a password',
              }}
            />
            <RF.Field
              // @ts-expect-error
              component={Layout.Field}
              name="passwordCheck"
              type="password"
              validate={validators.composeAsync(
                validators.required,
                validate('check', validators.matchesField('password')),
              )}
              disabled={submitting}
              floatingLabelText="Re-enter your new password"
              errors={{
                required: 'Enter the password again',
                check: 'Passwords must match',
              }}
              fullWidth
            />
            <Layout.Error
              {...{
                submitFailed,
                error: error || (!modifiedSinceLastSubmit && submitError),
              }}
              errors={{
                invalidToken: (
                  <>
                    This reset link is invalid (probably expired). Try{' '}
                    <Link to={urls.passReset()}>resetting password</Link> again.
                  </>
                ),
                invalid: 'Password must be at least 8 characters long',
                notAllowed: 'You are not allowed to set password.',
                userNotFound:
                  'User not found for this reset link. Please contact support.',
                unexpected: 'Something went wrong. Try again later.',
              }}
            />
            <Layout.Actions>
              <Layout.Submit
                label="Change Password"
                disabled={
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
    </Container>
  )
}

function Success() {
  const { urls } = NamedRoutes.use()
  return (
    <Container>
      <Layout.Message>Your password has been changed.</Layout.Message>
      <Layout.Message>
        <>
          Now you can <Link to={urls.signIn()}>sign in</Link> using your new password.
        </>
      </Layout.Message>
    </Container>
  )
}

const LINK_PLACEHOLDER = '_'

interface PassChangeProps {
  match: { params: { link: string } }
}

export default function PassChange({
  match: {
    params: { link },
  },
}: PassChangeProps) {
  const { urls } = NamedRoutes.use()

  const authenticated = redux.useSelector(selectors.authenticated)
  const [done, setDone] = React.useState(false)
  const onSuccess = React.useCallback(() => setDone(true), [setDone])

  const [storedLink] = React.useState(link)
  const history = useHistory()
  const cleanUrl = urls.passChange(LINK_PLACEHOLDER)

  React.useEffect(() => {
    if (link !== LINK_PLACEHOLDER) history.replace(cleanUrl)
  }, [link, history, cleanUrl])

  if (authenticated) return <SignOut />
  if (done) return <Success />
  return <Form {...{ onSuccess, link: storedLink }} />
}
