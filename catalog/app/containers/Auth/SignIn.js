import get from 'lodash/fp/get';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Link, Redirect } from 'react-router-dom';
import {
  branch,
  renderComponent,
  setPropTypes,
  withStateHandlers,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import { createStructuredSelector } from 'reselect';

import Spinner from 'components/Spinner';
import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import * as validators from 'utils/validators';
import withParsedQuery from 'utils/withParsedQuery';

import { signIn } from './actions';
import * as errors from './errors';
import msg from './messages';
import { authenticated } from './selectors';
import * as Form from './Form';


const DEFAULT_REDIRECT = '/profile';

export default composeComponent('Auth.SignIn',
  connect(createStructuredSelector({ authenticated })),
  reduxForm({
    form: 'Auth.SignIn',
    onSubmit: async (values, dispatch) => {
      const result = defer();
      dispatch(signIn(values.toJS(), result.resolver));
      try {
        await result.promise;
      } catch(e) {
        if (e instanceof errors.InvalidCredentials) {
          throw new SubmissionError({ _error: 'invalidCredentials' });
        }
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  withParsedQuery,
  branch(get('authenticated'), renderComponent(({ location: { query } }) =>
    <Redirect to={query.next || DEFAULT_REDIRECT} />
  )),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Form.Container>
      <form onSubmit={handleSubmit}>
        <Form.Heading><FM {...msg.signInHeading} /></Form.Heading>
        <Field
          component={Form.Field}
          name="username"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signInUsernameLabel} />}
          errors={{
            required: <FM {...msg.signInUsernameRequired} />,
          }}
        />
        <Field
          component={Form.Field}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signInPassLabel} />}
          errors={{
            required: <FM {...msg.signInPassRequired} />,
          }}
        />
        <Form.Error
          {...{ submitFailed, error }}
          errors={{
            // TODO: proper error messages
            invalidCredentials: 'Invalid credentials',
            unexpected: 'Something went wrong',
          }}
        />
        {/* TODO: show spinner */}
        <RaisedButton
          type="submit"
          primary
          disabled={submitting || (submitFailed && invalid)}
          label={<FM {...msg.signInSubmit} />}
        />
        {/* TODO: style & copy */}
        <p>Don't have an account? <Link to="/signup">Sign Up</Link>.</p>
        <p>Don't remember your password? <Link to="/reset_password">Reset the password</Link>.</p>
      </form>
    </Form.Container>
  ));
