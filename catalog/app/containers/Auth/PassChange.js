import * as R from 'ramda'
import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { connect } from 'react-redux'
import { branch, renderComponent, withStateHandlers } from 'recompose'
import { createStructuredSelector } from 'reselect'
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable'

import Working from 'components/Working'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import { composeComponent } from 'utils/reactTools'
import validate, * as validators from 'utils/validators'

import * as Layout from './Layout'
import { useSignOut } from './SignOut'
import { changePassword } from './actions'
import * as errors from './errors'
import msg from './messages'
import * as selectors from './selectors'

const Container = Layout.mkLayout(<FM {...msg.passChangeHeading} />)

export default composeComponent(
  'Auth.PassChange',
  connect(
    createStructuredSelector({
      authenticated: selectors.authenticated,
      waiting: selectors.waiting,
    }),
  ),
  branch(
    R.prop('authenticated'),
    renderComponent(({ waiting }) => {
      const doSignOut = useSignOut()
      React.useEffect(() => {
        if (!waiting) doSignOut()
      }, [waiting])
      return (
        <Container>
          <Working style={{ textAlign: 'center' }}>
            <FM {...msg.signOutWaiting} />
          </Working>
        </Container>
      )
    }),
  ),
  Sentry.inject(),
  withStateHandlers(
    {
      done: false,
    },
    {
      setDone: () => () => ({ done: true }),
    },
  ),
  reduxForm({
    form: 'Auth.PassChange',
    onSubmit: async (values, dispatch, { setDone, match, sentry }) => {
      try {
        const { link } = match.params
        const { password } = values.toJS()
        const result = defer()
        dispatch(changePassword(link, password, result.resolver))
        await result.promise
        setDone()
      } catch (e) {
        if (e instanceof errors.InvalidResetLink) {
          throw new SubmissionError({ _error: 'invalid' })
        }
        if (e instanceof errors.InvalidPassword) {
          throw new SubmissionError({ password: 'invalid' })
        }
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      }
    },
  }),
  branch(
    R.prop('done'),
    renderComponent(() => {
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
                  <Link to={urls.signIn()}>
                    <FM {...msg.passChangeSuccessCTALink} />
                  </Link>
                ),
              }}
            />
          </Layout.Message>
        </Container>
      )
    }),
  ),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => {
    const { urls } = NamedRoutes.use()
    return (
      <Container>
        <form onSubmit={handleSubmit}>
          <Field
            component={Layout.Field}
            name="password"
            type="password"
            validate={[validators.required]}
            disabled={submitting}
            floatingLabelText={<FM {...msg.passChangePassLabel} />}
            errors={{
              required: <FM {...msg.passChangePassRequired} />,
              invalid: <FM {...msg.passChangePassInvalid} />,
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
            floatingLabelText={<FM {...msg.passChangePassCheckLabel} />}
            errors={{
              required: <FM {...msg.passChangePassCheckRequired} />,
              check: <FM {...msg.passChangePassCheckMatch} />,
            }}
            fullWidth
          />
          <Layout.Error
            {...{ submitFailed, error }}
            errors={{
              invalid: (
                <FM
                  {...msg.passChangeErrorInvalid}
                  values={{
                    link: (
                      <Link to={urls.passReset()}>
                        <FM {...msg.passChangeErrorInvalidLink} />
                      </Link>
                    ),
                  }}
                />
              ),
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
      </Container>
    )
  },
)
