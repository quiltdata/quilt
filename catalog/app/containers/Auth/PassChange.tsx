import { FORM_ERROR } from 'final-form'
import * as React from 'react'
import * as RF from 'react-final-form'
import { FormattedMessage as FM } from 'react-intl'
import * as redux from 'react-redux'

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
import msg from './messages'
import * as selectors from './selectors'

const Container = Layout.mkLayout(<FM {...msg.passChangeHeading} />)

function SignOut() {
  const waiting = redux.useSelector(selectors.waiting)
  const signOutRef = React.useRef<() => void>()
  signOutRef.current = useSignOut()
  React.useEffect(() => {
    if (!waiting) signOutRef.current!()
  }, [waiting, signOutRef])
  return (
    <Container>
      <Working style={{ textAlign: 'center' }}>
        <FM {...msg.signOutWaiting} />
      </Working>
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
        return { password: 'invalid' }
      }
      sentry('captureException', e)
      return { [FORM_ERROR]: 'unexpected' }
    }
  }

  return (
    <Container>
      <RF.Form onSubmit={onSubmit}>
        {({ handleSubmit, submitting, submitFailed, invalid, error, submitError }) => (
          <form onSubmit={handleSubmit}>
            <RF.Field
              component={Layout.Field}
              name="password"
              type="password"
              // @ts-expect-error
              validate={validators.required}
              disabled={submitting}
              floatingLabelText={<FM {...msg.passChangePassLabel} />}
              errors={{
                required: <FM {...msg.passChangePassRequired} />,
                invalid: <FM {...msg.passChangePassInvalid} />,
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
              disabled={submitting}
              floatingLabelText={<FM {...msg.passChangePassCheckLabel} />}
              errors={{
                required: <FM {...msg.passChangePassCheckRequired} />,
                check: <FM {...msg.passChangePassCheckMatch} />,
              }}
              fullWidth
            />
            <Layout.Error
              {...{ submitFailed, error: error || submitError }}
              errors={{
                invalidToken: (
                  <FM
                    {...msg.passChangeErrorInvalidToken}
                    values={{
                      link: (
                        // @ts-expect-error
                        <Link to={urls.passReset()}>
                          <FM {...msg.passChangeErrorInvalidTokenLink} />
                        </Link>
                      ),
                    }}
                  />
                ),
                notAllowed: <FM {...msg.passChangeErrorNotAllowed} />,
                userNotFound: <FM {...msg.passChangeErrorUserNotFound} />,
                unexpected: <FM {...msg.passChangeErrorUnexpected} />,
              }}
            />
            <Layout.Actions>
              <Layout.Submit
                label={<FM {...msg.passChangeSubmit} />}
                disabled={submitting || (submitFailed && invalid)}
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
      <Layout.Message>
        <FM {...msg.passChangeSuccess} />
      </Layout.Message>
      <Layout.Message>
        <FM
          {...msg.passChangeSuccessCTA}
          values={{
            link: (
              // @ts-expect-error
              <Link to={urls.signIn()}>
                <FM {...msg.passChangeSuccessCTALink} />
              </Link>
            ),
          }}
        />
      </Layout.Message>
    </Container>
  )
}

interface PassChangeProps {
  match: { params: { link: string } }
}

export default function PassChange({
  match: {
    params: { link },
  },
}: PassChangeProps) {
  const authenticated = redux.useSelector(selectors.authenticated)
  const [done, setDone] = React.useState(false)
  const onSuccess = React.useCallback(() => setDone(true), [setDone])

  if (authenticated) return <SignOut />
  if (done) return <Success />
  return <Form {...{ onSuccess, link }} />
}
