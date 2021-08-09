import { goBack, push } from 'connected-react-router'
import * as React from 'react'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

import { push as notify } from 'containers/Notifications/actions'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import validate, * as validators from 'utils/validators'

import * as Layout from './Layout'
import * as actions from './actions'
import * as errors from './errors'
import * as selectors from './selectors'

const Container = Layout.mkLayout('Complete sign-up')

const Form = reduxForm({ form: 'Auth.SSO.SignUp' })(({ children, ...props }) => (
  <form onSubmit={props.handleSubmit}>{children(props)}</form>
))

export default ({ location: { search } }) => {
  const { provider, token, next } = parseSearch(search)

  const dispatch = redux.useDispatch()
  const { urls } = NamedRoutes.use()
  const sentry = Sentry.use()
  const authenticated = redux.useSelector(selectors.authenticated)
  const cfg = Config.useConfig()

  const back = React.useCallback(() => dispatch(goBack()), [dispatch])

  const onSubmit = React.useCallback(
    async (values) => {
      const { username, password } = values.toJS()
      try {
        const result = defer()
        const credentials = { username, provider, token }
        if (password != null) credentials.password = password
        dispatch(actions.signUp(credentials, result.resolver))
        await result.promise
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          throw new SubmissionError({ username: 'taken' })
        }
        if (e instanceof errors.InvalidUsername) {
          throw new SubmissionError({ username: 'invalid' })
        }
        if (password != null && e instanceof errors.InvalidPassword) {
          throw new SubmissionError({ password: 'invalid' })
        }
        if (e instanceof errors.EmailDomainNotAllowed) {
          throw new SubmissionError({ _error: 'emailDomain' })
        }
        if (e instanceof errors.SMTPError) {
          throw new SubmissionError({ _error: 'smtp' })
        }
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      }

      try {
        const result = defer()
        dispatch(actions.signIn({ provider, token }, result.resolver))
        await result.promise
      } catch (e) {
        dispatch(notify(`Couldn't sign in automatically`))
        dispatch(push(urls.signIn(next)))
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      }
    },
    [provider, token, next, urls, dispatch, sentry],
  )

  if (authenticated) {
    return <Redirect to={next || '/'} />
  }

  return (
    <Container>
      <Form onSubmit={onSubmit}>
        {({ submitting, submitFailed, invalid, error }) => (
          <>
            <Field
              component={Layout.Field}
              name="username"
              validate={[validators.required]}
              disabled={submitting}
              floatingLabelText="Username"
              errors={{
                required: 'Enter a username',
                taken: (
                  <>
                    Username taken, try{' '}
                    <Layout.FieldErrorLink to={urls.signIn(next)}>
                      signing in
                    </Layout.FieldErrorLink>
                  </>
                ),
                invalid: 'Username invalid',
              }}
            />
            {cfg.passwordAuth === true && (
              <>
                <Field
                  component={Layout.Field}
                  name="password"
                  type="password"
                  validate={[validators.required]}
                  disabled={submitting}
                  floatingLabelText="Password"
                  errors={{
                    required: 'Enter a password',
                    invalid: 'Password must be at least 8 characters long',
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
                  floatingLabelText="Verify password"
                  errors={{
                    required: 'Enter the password again',
                    check: 'Passwords must match',
                  }}
                />
              </>
            )}
            <Layout.Error
              {...{ submitFailed, error }}
              errors={{
                unexpected: 'Something went wrong. Try again later.',
                emailDomain: 'Email domain is not allowed',
                smtp: 'SMTP error: contact your administrator',
              }}
            />
            <Layout.Actions>
              <M.Button onClick={back} variant="outlined" disabled={submitting}>
                Cancel
              </M.Button>
              <M.Box mr={2} />
              <Layout.Submit
                label="Sign up"
                disabled={submitting || (submitFailed && invalid)}
                busy={submitting}
              />
            </Layout.Actions>
            <Layout.Hint>
              <>
                Already have an account? <Link to={urls.signIn(next)}>Sign in</Link>
              </>
            </Layout.Hint>
          </>
        )}
      </Form>
    </Container>
  )
}
