import get from 'lodash/fp/get'
import React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import { branch, renderComponent, withStateHandlers } from 'recompose'
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

// TODO: mutex stuff, convert to hooks
const PasswordSignUp = composeComponent(
  'Auth.SignUp.Password',
  withStateHandlers(
    {
      done: false,
    },
    {
      setDone: () => () => ({ done: true }),
    },
  ),
  Sentry.inject(),
  reduxForm({
    form: 'Auth.SignUp',
    onSubmit: async (values, dispatch, { setDone, sentry }) => {
      try {
        const result = defer()
        dispatch(signUp(values.remove('passwordCheck').toJS(), result.resolver))
        await result.promise
        setDone()
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
      }
    },
  }),
  branch(
    get('done'),
    renderComponent(() => (
      <Container>
        <Layout.Message>
          <FM {...msg.signUpSuccess} />
        </Layout.Message>
      </Container>
    )),
  ),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => {
    const { urls } = NamedRoutes.use()
    return (
      <form onSubmit={handleSubmit}>
        <Field
          component={Layout.Field}
          name="username"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signUpUsernameLabel} />}
          errors={{
            required: <FM {...msg.signUpUsernameRequired} />,
            taken: (
              <FM
                {...msg.signUpUsernameTaken}
                values={{
                  link: (
                    <Layout.FieldErrorLink to={urls.passReset()}>
                      <FM {...msg.signUpPassResetHint} />
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
          disabled={submitting}
          floatingLabelText={<FM {...msg.signUpEmailLabel} />}
          errors={{
            required: <FM {...msg.signUpEmailRequired} />,
            taken: (
              <FM
                {...msg.signUpEmailTaken}
                values={{
                  link: (
                    <Layout.FieldErrorLink to={urls.passReset()}>
                      <FM {...msg.signUpPassResetHint} />
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
          disabled={submitting}
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
          disabled={submitting}
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
            disabled={submitting || (submitFailed && invalid)}
            busy={submitting}
          />
        </Layout.Actions>
        <Layout.Hint>
          <FM
            {...msg.signUpHintSignIn}
            values={{
              link: (
                <Link to={urls.signIn()}>
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

  const ssoEnabled = (provider) => {
    if (cfg.ssoAuth !== true) return false
    const { ssoProviders = [] } = cfg
    return provider ? ssoProviders.includes(provider) : !!ssoProviders.length
  }

  if (authenticated) {
    return <Redirect to={parseSearch(search).next || cfg.signInRedirect} />
  }

  return (
    <Container>
      {ssoEnabled('google') && <SSOGoogle mutex={mutex} />}
      {cfg.passwordAuth === true && ssoEnabled() && <Layout.Or />}
      {cfg.passwordAuth === true && <PasswordSignUp mutex={mutex} />}
    </Container>
  )
}
