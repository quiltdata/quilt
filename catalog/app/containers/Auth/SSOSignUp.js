import { goBack, push } from 'connected-react-router'
import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import * as reduxHook from 'redux-react-hook'
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
import msg from './messages'
import * as selectors from './selectors'

const Container = Layout.mkLayout(<FM {...msg.ssoSignUpHeading} />)

const Form = reduxForm({ form: 'Auth.SSO.SignUp' })(({ children, ...props }) => (
  <form onSubmit={props.handleSubmit}>{children(props)}</form>
))

export default ({ location: { search } }) => {
  const { provider, token, next } = parseSearch(search)

  const dispatch = reduxHook.useDispatch()
  const { urls } = NamedRoutes.use()
  const sentry = Sentry.use()
  const authenticated = reduxHook.useMappedState(selectors.authenticated)
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
        dispatch(notify(<FM {...msg.ssoSignUpSignInError} />))
        dispatch(push(urls.signIn(next)))
        sentry('captureException', e)
        throw new SubmissionError({ _error: 'unexpected' })
      }
    },
    [provider, token, next, urls, dispatch],
  )

  if (authenticated) {
    return <Redirect to={next || cfg.signInRedirect} />
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
            {cfg.passwordAuth === true && (
              <>
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
              </>
            )}
            <Layout.Error
              {...{ submitFailed, error }}
              errors={{
                unexpected: <FM {...msg.signUpErrorUnexpected} />,
                emailDomain: <FM {...msg.ssoSignUpErrorEmailDomain} />,
                smtp: <FM {...msg.signUpErrorSMTP} />,
              }}
            />
            <Layout.Actions>
              <M.Button onClick={back} variant="outlined" disabled={submitting}>
                <FM {...msg.ssoSignUpCancel} />
              </M.Button>
              <M.Box mr={2} />
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
                    <Link to={urls.signIn(next)}>
                      <FM {...msg.signUpHintSignInLink} />
                    </Link>
                  ),
                }}
              />
            </Layout.Hint>
          </>
        )}
      </Form>
    </Container>
  )
}
