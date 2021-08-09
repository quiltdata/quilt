import get from 'lodash/fp/get'
import React from 'react'
import { branch, renderComponent, withStateHandlers } from 'recompose'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import { composeComponent } from 'utils/reactTools'
import * as validators from 'utils/validators'

import { resetPassword } from './actions'
import * as errors from './errors'
import * as Layout from './Layout'

const Container = Layout.mkLayout('Reset Password')

// TODO: what to show if user is authenticated?
export default composeComponent(
  'Auth.PassReset',
  // connect(createStructuredSelector({ authenticated })),
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
    form: 'Auth.PassReset',
    onSubmit: async (values, dispatch, { setDone, sentry }) => {
      try {
        const result = defer()
        dispatch(resetPassword(values.toJS().email, result.resolver))
        await result.promise
        setDone()
      } catch (e) {
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
          You have requested a password reset. Check your email for further instructions.
        </Layout.Message>
      </Container>
    )),
  ),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => {
    const cfg = Config.useConfig()
    const { urls } = NamedRoutes.use()
    return (
      <Container>
        <form onSubmit={handleSubmit}>
          <Field
            component={Layout.Field}
            name="email"
            validate={[validators.required]}
            disabled={submitting}
            floatingLabelText="Email"
            errors={{
              required: 'Enter your email',
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
              label="Reset"
              disabled={submitting || (submitFailed && invalid)}
              busy={submitting}
            />
          </Layout.Actions>
          {(cfg.passwordAuth === true || cfg.ssoAuth === true) && (
            <Layout.Hint>
              <>
                Don&apos;t have an account? <Link to={urls.signUp()}>Sign up</Link>
              </>
            </Layout.Hint>
          )}
        </form>
      </Container>
    )
  },
)
