import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import * as reduxHook from 'redux-react-hook'

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
import SSOGoogle from './SSOGoogle'
import { signUp } from './actions'
import * as errors from './errors'
import msg from './messages'
import * as selectors from './selectors'

const Container = Layout.mkLayout(<FM {...msg.signUpHeading} />)

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
          floatingLabelText={<FM {...msg.signUpUsernameLabel} />}
          errors={{
            required: <FM {...msg.signUpUsernameRequired} />,
            taken: (
              <FM
                {...msg.signUpUsernameTaken}
                values={{
                  link: (
                    <Layout.FieldErrorLink to={urls.signIn(next)}>
                      <FM {...msg.signUpSignInHint} />
                    </Layout.FieldErrorLink>
                  ),
                }}
              />
            ),
            invalid: <FM {...msg.signUpUsernameInvalid} />,
          }}
        />
        <Field
          component={Layout.Field}
          name="email"
          validate={[validators.required]}
          disabled={!!mutex.current || submitting}
          floatingLabelText={<FM {...msg.signUpEmailLabel} />}
          errors={{
            required: <FM {...msg.signUpEmailRequired} />,
            taken: (
              <FM
                {...msg.signUpEmailTaken}
                values={{
                  link: (
                    <Layout.FieldErrorLink to={urls.signIn(next)}>
                      <FM {...msg.signUpSignInHint} />
                    </Layout.FieldErrorLink>
                  ),
                }}
              />
            ),
            invalid: <FM {...msg.signUpEmailInvalid} />,
          }}
        />
        <Field
          component={Layout.Field}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={!!mutex.current || submitting}
          floatingLabelText={<FM {...msg.signUpPassLabel} />}
          errors={{
            required: <FM {...msg.signUpPassRequired} />,
            invalid: <FM {...msg.signUpPassInvalid} />,
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
          floatingLabelText={<FM {...msg.signUpPassCheckLabel} />}
          errors={{
            required: <FM {...msg.signUpPassCheckRequired} />,
            check: <FM {...msg.signUpPassCheckMatch} />,
          }}
        />
        <Layout.Error
          {...{ submitFailed, error }}
          errors={{
            unexpected: <FM {...msg.signUpErrorUnexpected} />,
            smtp: <FM {...msg.signUpErrorSMTP} />,
          }}
        />
        <Layout.Actions>
          <Layout.Submit
            label={<FM {...msg.signUpSubmit} />}
            disabled={!!mutex.current || submitting || (submitFailed && invalid)}
            busy={submitting}
          />
        </Layout.Actions>
        <Layout.Hint>
          <FM
            {...msg.signUpHintSignIn}
            values={{
              link: (
                <Link to={urls.signIn(next)}>
                  <FM {...msg.signUpHintSignInLink} />
                </Link>
              ),
            }}
          />
        </Layout.Hint>
      </form>
    )
  },
)

export default ({ location: { search } }) => {
  const authenticated = reduxHook.useMappedState(selectors.authenticated)
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
    return <Redirect to={next || cfg.signInRedirect} />
  }

  if (done)
    return (
      <Container>
        <Layout.Message>
          <FM {...msg.signUpSuccess} />
        </Layout.Message>
      </Container>
    )

  return (
    <Container>
      {ssoEnabled('google') && <SSOGoogle mutex={mutex} next={next} />}
      {cfg.passwordAuth === true && ssoEnabled() && <Layout.Or />}
      {cfg.passwordAuth === true && (
        <PasswordSignUp mutex={mutex} onSuccess={() => setDone(true)} next={next} />
      )}
    </Container>
  )
}
