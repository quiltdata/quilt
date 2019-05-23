import get from 'lodash/fp/get'
import React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { connect } from 'react-redux'
import { Redirect } from 'react-router-dom'
import { branch, renderComponent } from 'recompose'
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable'
import { createStructuredSelector } from 'reselect'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import { composeComponent } from 'utils/reactTools'
import * as validators from 'utils/validators'
import withParsedQuery from 'utils/withParsedQuery'

import { signIn } from './actions'
import * as errors from './errors'
import msg from './messages'
import * as selectors from './selectors'
import * as Layout from './Layout'

const Container = Layout.mkLayout(<FM {...msg.signInHeading} />)

export default composeComponent(
  'Auth.SignIn',
  connect(
    createStructuredSelector({
      authenticated: selectors.authenticated,
    }),
  ),
  Sentry.inject(),
  reduxForm({
    form: 'Auth.SignIn',
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
  withParsedQuery,
  branch(
    get('authenticated'),
    renderComponent(({ location: { query } }) => {
      const cfg = Config.useConfig()
      return <Redirect to={query.next || cfg.signInRedirect} />
    }),
  ),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => {
    const cfg = Config.useConfig()
    const { urls } = NamedRoutes.use()

    return (
      <Container>
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
          {!cfg.disableSignUp && (
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
        </form>
      </Container>
    )
  },
)
