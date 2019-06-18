import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import * as reduxHook from 'redux-react-hook'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import { GoogleLogin } from 'react-google-login'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import { composeComponent } from 'utils/reactTools'
import * as validators from 'utils/validators'

import { signIn } from './actions'
import * as errors from './errors'
import msg from './messages'
import * as selectors from './selectors'
import * as Layout from './Layout'

const Container = Layout.mkLayout(<FM {...msg.signInHeading} />)

const PasswordSignIn = composeComponent(
  'Auth.SignIn.Password',
  Sentry.inject(),
  reduxForm({
    form: 'Auth.SignIn.Password',
    onSubmit: async (values, dispatch, { sentry }) => {
      const result = defer()
      dispatch(signIn(values.toJS(), result.resolver))
      try {
        await result.promise
      } catch (e) {
        if (e instanceof errors.InvalidCredentials) {
          throw new SubmissionError({ _error: 'invalidCredentials' })
        }
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      }
    },
  }),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => {
    return (
      <form onSubmit={handleSubmit}>
        <Field
          component={Layout.Field}
          name="username"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signInUsernameLabel} />}
          errors={{
            required: <FM {...msg.signInUsernameRequired} />,
          }}
        />
        <Field
          component={Layout.Field}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signInPassLabel} />}
          errors={{
            required: <FM {...msg.signInPassRequired} />,
          }}
        />
        <Layout.Error
          {...{ submitFailed, error }}
          errors={{
            invalidCredentials: <FM {...msg.signInErrorInvalidCredentials} />,
            unexpected: <FM {...msg.signInErrorUnexpected} />,
          }}
        />
        <Layout.Actions>
          <Layout.Submit
            label={<FM {...msg.signInSubmit} />}
            disabled={submitting || (submitFailed && invalid)}
            busy={submitting}
          />
        </Layout.Actions>
      </form>
    )
  },
)

const GoogleSignIn = () => {
  const dispatch = reduxHook.useDispatch()
  const cfg = Config.useConfig()
  return (
    <Layout.Actions>
      <GoogleLogin
        clientId={cfg.googleClientId}
        buttonText={<FM {...msg.signInWithGoogle} />}
        onSuccess={async (user) => {
          console.log('onSuccess', user)
          const { id_token: token } = user.getAuthResponse()
          const result = defer()
          dispatch(signIn({ provider: 'google', token }, result.resolver))
          try {
            await result.promise
          } catch (e) {
            if (e instanceof errors.InvalidCredentials) {
              console.log('sso error: invalid credentials', e)
            } else {
              console.log('sso error: unexpected', e)
              throw e
            }
          }
        }}
        cookiePolicy="single_host_origin"
        //disabled={submitting}
      />
    </Layout.Actions>
  )
}

export default ({ location: { search } }) => {
  const authenticated = reduxHook.useMappedState(selectors.authenticated)
  const cfg = Config.useConfig()
  const { urls } = NamedRoutes.use()

  if (authenticated) {
    return <Redirect to={parseSearch(search).next || cfg.signInRedirect} />
  }

  return (
    <Container>
      {cfg.signInProviders.includes('password') && <PasswordSignIn />}
      {cfg.signInProviders.includes('google') && !!cfg.googleClientId && <GoogleSignIn />}
      {!!cfg.signUpProviders && !!cfg.signUpProviders.length && (
        <Layout.Hint>
          <FM
            {...msg.signInHintSignUp}
            values={{
              link: (
                <Link to={urls.signUp()}>
                  <FM {...msg.signInHintSignUpLink} />
                </Link>
              ),
            }}
          />
        </Layout.Hint>
      )}
      <Layout.Hint>
        <FM
          {...msg.signInHintReset}
          values={{
            link: (
              <Link to={urls.passReset()}>
                <FM {...msg.signInHintResetLink} />
              </Link>
            ),
          }}
        />
      </Layout.Hint>
    </Container>
  )
}
