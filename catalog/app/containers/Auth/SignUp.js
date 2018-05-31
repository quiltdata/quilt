import get from 'lodash/fp/get';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { Link } from 'react-router-dom';
import {
  branch,
  renderComponent,
  withStateHandlers,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';

import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import validate, * as validators from 'utils/validators';

import * as errors from './errors';
import msg from './messages';
import { signUp } from './requests';
import * as Layout from './Layout';


const Container = Layout.mkLayout(<FM {...msg.signUpHeading} />);

// TODO: what to show if authenticated?
export default composeComponent('Auth.SignUp',
  withStateHandlers({
    done: false,
  }, {
    setDone: () => () => ({ done: true }),
  }),
  reduxForm({
    form: 'Auth.SignUp',
    onSubmit: async (values, dispatch, { setDone }) => {
      try {
        await signUp(values.remove('passwordCheck').toJS());
        setDone();
      } catch (e) {
        if (e instanceof errors.UsernameTaken) {
          throw new SubmissionError({ username: 'taken' });
        }
        if (e instanceof errors.InvalidUsername) {
          throw new SubmissionError({ username: 'invalid' });
        }
        if (e instanceof errors.EmailTaken) {
          throw new SubmissionError({ email: 'taken' });
        }
        if (e instanceof errors.InvalidEmail) {
          throw new SubmissionError({ email: 'invalid' });
        }
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  branch(get('done'), renderComponent(() => (
    <Container>
      <Layout.Message>
        <FM {...msg.signUpSuccess} />
      </Layout.Message>
    </Container>
  ))),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
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
                    <Layout.FieldErrorLink to="/reset_password">
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
                    <Layout.FieldErrorLink to="/reset_password">
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
                <Link to="/signin">
                  <FM {...msg.signUpHintSignInLink} />
                </Link>
              ),
            }}
          />
        </Layout.Hint>
      </form>
    </Container>
  ));
