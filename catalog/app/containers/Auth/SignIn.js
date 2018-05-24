import get from 'lodash/fp/get';
import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import PT from 'prop-types';
import React from 'react';
import { FormattedMessage as FM } from 'react-intl';
import { connect } from 'react-redux';
import { Link, Redirect } from 'react-router-dom';
import {
  branch,
  mapProps,
  renderComponent,
  setPropTypes,
  withStateHandlers,
} from 'recompose';
import { reduxForm, Field, SubmissionError } from 'redux-form/immutable';
import { createStructuredSelector } from 'reselect';
import styled from 'styled-components';

import Spinner from 'components/Spinner';
import defer from 'utils/defer';
import { captureError } from 'utils/errorReporting';
import { composeComponent } from 'utils/reactTools';
import * as validators from 'utils/validators';

import { signIn } from './actions';
import * as errors from './errors';
import msg from './messages';
import { authenticated } from './selectors';

const showError = (meta, errorMessages = {}) =>
  meta.submitFailed && meta.error
    ? errorMessages[meta.error] || meta.error
    : undefined;

const FormField = composeComponent('Auth.SignUp.Field',
  setPropTypes({
    input: PT.object.isRequired,
    meta: PT.object.isRequired,
    errors: PT.objectOf(PT.node),
  }),
  mapProps(({ input, meta, errors, ...rest }) => ({
    errorText: showError(meta, errors),
    ...input,
    ...rest,
  })),
  TextField);

const Container = styled.div`
  margin-left: auto;
  margin-right: auto;
  width: 400px;
`;

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
        // TODO: handle all the errors from the BE
        //if (e instanceof errors.UserAlreadyExists) {
          //throw new SubmissionError({ _error: 'uniq' });
        //}
        captureError(e);
        throw new SubmissionError({ _error: 'unexpected' });
      }
    },
  }),
  // TODO: styling, copy
  branch(get('authenticated'), renderComponent(({}) => {
    // TODO: get next from route params
    const next = '/';
    return (
      <div>
        <h1>signed in</h1>
        <Redirect to={next} />
      </div>
    );
  })),
  ({ handleSubmit, submitting, submitFailed, invalid, error }) => (
    <Container>
      <form onSubmit={handleSubmit}>
        <h1><FM {...msg.signInHeading} /></h1>
        <Field
          component={FormField}
          name="username"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signInUsernameLabel} />}
          errors={{
            required: <FM {...msg.signInUsernameRequired} />,
          }}
          fullWidth
        />
        <Field
          component={FormField}
          name="password"
          type="password"
          validate={[validators.required]}
          disabled={submitting}
          floatingLabelText={<FM {...msg.signInPassLabel} />}
          errors={{
            required: <FM {...msg.signInPassRequired} />,
          }}
          fullWidth
        />
        {/* TODO: style & copy */}
        {submitFailed && error && (
          <p>form error: {error}</p>
        )}
        {/* TODO: show spinner */}
        <RaisedButton
          type="submit"
          primary
          disabled={submitting || submitFailed && invalid}
          label={<FM {...msg.signInSubmit} />}
        />
        {/* TODO: style & copy */}
        <p>Don't have an account? <Link to="/signup">Sign Up</Link>.</p>
        {/* TODO: forget / reset link */}
        <p>Don't remember your password? <Link to="/signup">Reset the password</Link>.</p>
      </form>
    </Container>
  ));
