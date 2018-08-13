// @flow

import get from 'lodash/fp/get';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Link, Redirect } from 'react-router-dom';
import { branch, renderComponent } from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import { createStructuredSelector } from 'reselect';

import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import * as validators from 'utils/validators';
import withParsedQuery from 'utils/withParsedQuery';

import { signIn } from './actions';
import * as errors from './errors';
import msg from './messages';
import * as selectors from './selectors';
import * as Layout from './Layout';


const Container = Layout.mkLayout(<FM {...msg.signInHeading} />);

export default composeComponent('Auth.SignIn',
  connect(createStructuredSelector({
    authenticated: selectors.authenticated,
    signInRedirect: selectors.signInRedirect,
  })),
  reduxForm({
    form: 'Auth.SignIn',
    onSubmit: async (values, dispatch) => {
      const result = defer();
      dispatch(signIn(values.toJS(), result.resolver));
      try {
        await result.promise;
      } catch (e) {
        if (e instanceof errors.InvalidCredentials) {
          throw new SubmissionError({ _error: 'invalidCredentials' });
        }
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  withParsedQuery,
  branch(get('authenticated'),
    renderComponent(({ location: { query }, signInRedirect }) =>
      <Redirect to={query.next || signInRedirect} />)),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
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
        <Layout.Hint>
          <FM
            {...msg.signInHintSignUp}
            values={{
              link: (
                <Link to="/signup">
                  <FM {...msg.signInHintSignUpLink} />
                </Link>
              ),
            }}
          />
        </Layout.Hint>
        <Layout.Hint>
          <FM
            {...msg.signInHintReset}
            values={{
              link: (
                <Link to="/reset_password">
                  <FM {...msg.signInHintResetLink} />
                </Link>
              ),
            }}
          />
        </Layout.Hint>
      </form>
    </Container>
  ));
