import { goBack, push } from 'connected-react-router'
import * as FF from 'final-form'
import * as React from 'react'
import * as redux from 'react-redux'
import { Redirect } from 'react-router-dom'
import * as RF from 'react-final-form'
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

export default ({ location: { search } }) => {
  const { provider, token, next } = parseSearch(search)

  const dispatch = redux.useDispatch()
  const { urls } = NamedRoutes.use()
  const sentry = Sentry.use()
  const authenticated = redux.useSelector(selectors.authenticated)
  const cfg = Config.useConfig()

  const back = React.useCallback(() => dispatch(goBack()), [dispatch])

  const onSubmit = React.useCallback(
    async ({ username, password }) => {
      try {
        const result = defer()
        const credentials = { username, provider, token }
        if (password != null) credentials.password = password
        dispatch(actions.signUp(credentials, result.resolver))
        await result.promise
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          return {
            username: 'taken',
          }
        }
        if (e instanceof errors.InvalidUsername) {
          return {
            username: 'invalid',
          }
        }
        if (password != null && e instanceof errors.InvalidPassword) {
          return {
            password: 'invalid',
          }
        }
        if (e instanceof errors.NoDefaultRole) {
          return {
            [FF.FORM_ERROR]: 'noDefaultRole',
          }
        }
        if (e instanceof errors.EmailDomainNotAllowed) {
          return {
            [FF.FORM_ERROR]: 'emailDomain',
          }
        }
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

      try {
        const result = defer()
        dispatch(actions.signIn({ provider, token }, result.resolver))
        await result.promise
      } catch (e) {
        dispatch(notify(`Couldn't sign in automatically`))
        dispatch(push(urls.signIn(next)))
        sentry('captureException', e)
        return {
          [FF.FORM_ERROR]: 'unexpected',
        }
      }
    },
    [provider, token, next, urls, dispatch, sentry],
  )

  if (authenticated) {
    return <Redirect to={next || '/'} />
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
              component={Layout.Field}
              name="username"
              validate={validators.required}
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
                <RF.Field
                  component={Layout.Field}
                  name="password"
                  type="password"
                  validate={validators.required}
                  disabled={submitting}
                  floatingLabelText="Password"
                  errors={{
                    required: 'Enter a password',
                    invalid: 'Password must be at least 8 characters long',
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
                  floatingLabelText="Verify password"
                  errors={{
                    required: 'Enter the password again',
                    check: 'Passwords must match',
                  }}
                />
              </>
            )}
            <Layout.Error
              {...{
                submitFailed,
                error: error || (!modifiedSinceLastSubmit && submitError),
              }}
              errors={{
                unexpected: 'Something went wrong. Try again later.',
                emailDomain: 'Email domain is not allowed',
                smtp: 'SMTP error: contact your administrator',
                noDefaultRole:
                  'Unable to assign role. Ask your Quilt administrator to set a default role.',
              }}
            />
            <Layout.Actions>
              <M.Button onClick={back} variant="outlined" disabled={submitting}>
                Cancel
              </M.Button>
              <M.Box mr={2} />
              <Layout.Submit
                label="Sign up"
                disabled={
                  submitting ||
                  (hasValidationErrors && submitFailed) ||
                  (hasSubmitErrors && !modifiedSinceLastSubmit)
                }
                busy={submitting}
              />
            </Layout.Actions>
            <Layout.Hint>
              <>
                Already have an account? <Link to={urls.signIn(next)}>Sign in</Link>
              </>
            </Layout.Hint>
          </form>
        )}
      </RF.Form>
    </Container>
  )
}
