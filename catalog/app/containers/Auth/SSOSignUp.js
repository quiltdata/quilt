import { goBack } from 'connected-react-router'
import * as React from 'react'
import { FormattedMessage as FM } from 'react-intl'
import { Redirect } from 'react-router-dom'
import { reduxForm, Field, SubmissionError } from 'redux-form/es/immutable'
import * as reduxHook from 'redux-react-hook'
import * as M from '@material-ui/core'
import { unstable_Box as Box } from '@material-ui/core/Box'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Sentry from 'utils/Sentry'
import Link from 'utils/StyledLink'
import defer from 'utils/defer'
import parseSearch from 'utils/parseSearch'
import { composeComponent } from 'utils/reactTools'
import validate, * as validators from 'utils/validators'

import * as Layout from './Layout'
import * as actions from './actions'
import * as errors from './errors'
import msg from './messages'
import * as selectors from './selectors'

const Container = Layout.mkLayout(<FM {...msg.ssoSignUpHeading} />)

const SSOSignUp = composeComponent(
  'Auth.SSO.SignUp',
  Sentry.inject(),
  reduxForm({
    form: 'Auth.SSO.SignUp',
    onSubmit: async (values, dispatch, { provider, token, sentry }) => {
      const { username, password } = values.toJS()
      try {
        const result = defer()
        dispatch(actions.signUp({ username, password, provider, token }, result.resolver))
        await result.promise
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          throw new SubmissionError({ username: 'taken' })
        }
        if (e instanceof errors.InvalidUsername) {
          throw new SubmissionError({ username: 'invalid' })
        }
        if (e instanceof errors.InvalidPassword) {
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
        // TODO: handle error
        console.log('couldnt sign in', e)
      }
    },
  }),
  ({ next, handleSubmit, submitting, submitFailed, invalid, error }) => {
    const { urls } = NamedRoutes.use()
    const dispatch = reduxHook.useDispatch()
    const back = React.useCallback(() => dispatch(goBack()), [dispatch])
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
            emailDomain: <FM {...msg.ssoSignUpErrorEmailDomain} />,
            smtp: <FM {...msg.signUpErrorSMTP} />,
          }}
        />
        <Layout.Actions>
          <M.Button onClick={back} variant="outlined" disabled={submitting}>
            <FM {...msg.ssoSignUpCancel} />
          </M.Button>
          <Box mr={2} />
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
      </form>
    )
  },
)

export default ({ location: { search } }) => {
  const { provider, token, next } = parseSearch(search)

  const authenticated = reduxHook.useMappedState(selectors.authenticated)
  const cfg = Config.useConfig()

  if (authenticated) {
    return <Redirect to={next || cfg.signInRedirect} />
  }

  return (
    <Container>
      <SSOSignUp {...{ provider, token, next }} />
    </Container>
  )
}
