import * as FF from 'final-form'
import React from 'react'
import * as RF from 'react-final-form'
import * as redux from 'react-redux'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import * as validators from 'utils/validators'

import { resetPassword } from './actions'
import * as errors from './errors'
import * as Layout from './Layout'

const Container = Layout.mkLayout('Reset Password')

export default function PassReset() {
  const [done, setDone] = React.useState(false)
  const sentry = Sentry.use()
  const dispatch = redux.useDispatch()
  const cfg = Config.useConfig()
  const { urls } = NamedRoutes.use()

  const onSubmit = React.useCallback(
    // eslint-disable-next-line consistent-return
    async (values) => {
      try {
        const result = defer()
        dispatch(resetPassword(values.email, result.resolver))
        await result.promise
        setDone()
      } catch (e) {
        if (e instanceof errors.SMTPError) {
          return {
            [FF.FORM_ERROR]: 'smtp',
          }
        }
        sentry('captureException', e)
        return {
          [FF.FORM_ERROR]: 'unexpected',
        }
      }
    },
    [dispatch, sentry, setDone],
  )

  if (done) {
    return (
      <Container>
        <Layout.Message>
          You have requested a password reset. Check your email for further instructions.
        </Layout.Message>
      </Container>
    )
  }

  return (
    <Container>
      <RF.Form onSubmit={onSubmit}>
        {({ handleSubmit, submitting, submitFailed, invalid, error }) => (
          <form onSubmit={handleSubmit}>
            <RF.Field
              component={Layout.Field}
              name="email"
              validate={validators.required}
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
        )}
      </RF.Form>
    </Container>
  )
}
